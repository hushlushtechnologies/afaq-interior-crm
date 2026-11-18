import 'server-only';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { requireCapability } from '@/features/access/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getApplicationOrigin } from '@/lib/supabase/server-config';
import { createDraftPdfWorkflow, DraftPdfOperationError } from './pdf-workflow';

export async function getLocalDraftPdfWorkflow() {
  if (process.env.ENABLE_LOCAL_QUOTATION_PDFS !== 'true')
    throw new DraftPdfOperationError('Local draft PDF operations are disabled.', false);
  const app = new URL(getApplicationOrigin());
  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL !== 'http://127.0.0.1:57421' ||
    app.protocol !== 'http:' ||
    !['localhost', '127.0.0.1'].includes(app.hostname) ||
    !/^project_id\s*=\s*"afaq-interiors-crm-s09-local"\s*$/m.test(
      readFileSync(resolve('supabase/config.toml'), 'utf8'),
    )
  )
    throw new DraftPdfOperationError('This workflow requires the dedicated local project.', false);
  await requireCapability('quotations.view');
  const employee = await createSupabaseServerClient();
  const identity = await employee.auth.getUser();
  if (identity.error || !identity.data.user)
    throw new DraftPdfOperationError('Sign in with an active employee account.', false);
  const key = process.env.SUPABASE_LOCAL_TEST_SECRET_KEY?.trim();
  if (!key) throw new DraftPdfOperationError('The local administrative binding is missing.', false);
  const admin = createClient('http://127.0.0.1:57421', key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return createDraftPdfWorkflow(admin, identity.data.user.id);
}