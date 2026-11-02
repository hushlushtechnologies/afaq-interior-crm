import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

class SetupError extends Error {}

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new SetupError('Provide the confirmed local account email as the command argument.');
  }

  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_LOCAL_TEST_SECRET_KEY?.trim();

  if (!rawUrl || !secret) {
    throw new SetupError('The local Supabase URL or local test-only secret key is missing.');
  }

  const url = new URL(rawUrl);

  if (
    url.protocol !== 'http:' ||
    !['127.0.0.1', 'localhost'].includes(url.hostname) ||
    url.port !== '57421' ||
    url.pathname !== '/' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new SetupError(
      'Bootstrap is restricted to the dedicated local Supabase instance on port 57421.',
    );
  }

  const configuration = readFileSync(resolve('supabase/config.toml'), 'utf8');

  if (!/^\s*project_id\s*=\s*"afaq-interiors-crm-s09-local"\s*(?:#.*)?$/m.test(configuration)) {
    throw new SetupError('The expected dedicated local Supabase project ID was not found.');
  }

  const admin = createClient(url.origin, secret, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  let target = null;

  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 100,
    });

    if (error) {
      throw new SetupError(
        'Could not inspect local accounts. Check the local test-only secret key.',
      );
    }

    target = data.users.find((user) => user.email?.toLowerCase() === email) ?? null;

    if (target || data.users.length < 100) {
      break;
    }
  }

  if (!target) {
    throw new SetupError('The requested account was not found in this local Supabase instance.');
  }

  if (!target.email_confirmed_at) {
    throw new SetupError('Confirm the account email before bootstrapping Super Admin.');
  }

  const { error } = await admin.rpc('crm_bootstrap_super_admin', {
    p_user_id: target.id,
  });

  if (error) {
    throw new SetupError(`Bootstrap RPC failed with code ${error.code}.`);
  }

  console.log(
    'Local Super Admin bootstrap completed. Sign in with that account and open /dev/access-setup.',
  );
}

main().catch((error) => {
  console.error(
    error instanceof SetupError
      ? error.message
      : 'Local Super Admin bootstrap could not be completed.',
  );

  process.exitCode = 1;
});
