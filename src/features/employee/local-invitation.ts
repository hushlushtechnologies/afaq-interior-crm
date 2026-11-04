import 'server-only';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { getApplicationOrigin } from '@/lib/supabase/server-config';

export function getLocalInvitationSettings() {
  const origin = getApplicationOrigin();
  const app = new URL(origin);
  const config = readFileSync(resolve('supabase/config.toml'), 'utf8');

  if (
    process.env.ENABLE_LOCAL_EMPLOYEE_INVITES !== 'true' ||
    process.env.NEXT_PUBLIC_SUPABASE_URL !== 'http://127.0.0.1:57421' ||
    app.protocol !== 'http:' ||
    !['localhost', '127.0.0.1'].includes(app.hostname) ||
    !/^project_id\s*=\s*"afaq-interiors-crm-s09-local"/m.test(config) ||
    !/\[local_smtp\]\s*enabled\s*=\s*true/m.test(config)
  ) {
    throw new Error('Local invitation delivery is disabled.');
  }

  return { origin, url: 'http://127.0.0.1:57421' };
}

export function createLocalInvitationAdmin() {
  const { url } = getLocalInvitationSettings();
  const key = process.env.SUPABASE_LOCAL_TEST_SECRET_KEY;

  if (!key) throw new Error('The local administrative binding is unavailable.');

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
