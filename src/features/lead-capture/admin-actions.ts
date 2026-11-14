'use server';
import { z } from 'zod';
import { requireCapability } from '@/features/access/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { localCapture, processCapture } from './workflow';

const configSchema = z
  .object({
    id: z.uuid(),
    principalId: z.uuid(),
    provider: z.enum(['website', 'meta']),
    source: z.enum(['website', 'facebook', 'instagram']),
    binding: z.string().regex(/^CAPTURE_[A-Z0-9_]{1,60}$/),
    owner: z.uuid().nullable(),
    page: z.string().nullable(),
    form: z.string().nullable(),
    active: z.boolean(),
    expires: z.iso.datetime({ offset: true }),
    version: z.number().int().positive().nullable(),
  })
  .strict();
export async function captureAdmin(
  action: 'review' | 'save' | 'retry' | 'process',
  input: unknown,
) {
  try {
    localCapture();
    await requireCapability('integrations.manage', 'company');
    const client = await createSupabaseServerClient();
    if (action === 'process') {
      const authority = await client.rpc('crm_capture_review', { p_page: 0 });
      if (authority.error) throw new Error('Super Admin capture review required.');
      return { status: 'ok' as const, data: await processCapture(z.uuid().parse(input)) };
    }
    const call =
      action === 'review'
        ? client.rpc('crm_capture_review', {
            p_page: z.number().int().min(0).max(10000).parse(input),
          })
        : action === 'retry'
          ? (() => {
              const v = z
                .object({ id: z.uuid(), version: z.number().int().positive() })
                .strict()
                .parse(input);
              return client.rpc('crm_capture_retry', { p_id: v.id, p_version: v.version });
            })()
          : (() => {
              const v = configSchema.parse(input);
              return client.rpc('crm_capture_config', {
                p_id: v.id,
                p_principal: v.principalId,
                p_provider: v.provider,
                p_source: v.source,
                p_binding: v.binding,
                p_owner: v.owner,
                p_page: v.page,
                p_form: v.form,
                p_active: v.active,
                p_expires: v.expires,
                p_version: v.version,
              });
            })();
    const result = await call;
    if (result.error)
      return {
        status: 'error' as const,
        message:
          'The capture operation was denied or changed. Reload and review authority, owner and version.',
      };
    return { status: 'ok' as const, data: result.data as unknown };
  } catch {
    return {
      status: 'error' as const,
      message:
        'Local capture administration could not be verified. Check your permission, configuration and input.',
    };
  }
}