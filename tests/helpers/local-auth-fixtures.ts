import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import type { RoleKey } from '../../src/features/access/catalog';

export type LocalTestAccount = {
  id: string;
  email: string;
  password: string;
};

export type LocalAuthFixtures = {
  createAccount: (options?: {
    confirmed?: boolean;
    role?: RoleKey | null;
  }) => Promise<LocalTestAccount>;

  isEmailConfirmed: (id: string) => Promise<boolean>;

  checkPublicSignup: () => Promise<{
    errorCode: string | null;
    returnedUser: boolean;
  }>;

  cleanup: () => Promise<void>;
};

export function createTestPassword() {
  return `S09!${randomBytes(18).toString('base64url')}7a`;
}

export function createLocalAuthFixtures(applicationUrl: string): LocalAuthFixtures {
  const application = new URL(applicationUrl);

  if (
    application.protocol !== 'http:' ||
    !['127.0.0.1', 'localhost'].includes(application.hostname)
  ) {
    throw new Error('Authentication fixtures require a local application URL.');
  }

  const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!rawSupabaseUrl) {
    throw new Error('The local Supabase URL is missing.');
  }

  const supabaseUrl = new URL(rawSupabaseUrl);

  if (
    supabaseUrl.protocol !== 'http:' ||
    !['127.0.0.1', 'localhost'].includes(supabaseUrl.hostname) ||
    supabaseUrl.port !== '57421' ||
    supabaseUrl.pathname !== '/' ||
    supabaseUrl.username ||
    supabaseUrl.password ||
    supabaseUrl.search ||
    supabaseUrl.hash
  ) {
    throw new Error(
      'Authentication fixtures are restricted to the dedicated local Supabase instance on port 57421.',
    );
  }

  const configuration = readFileSync(resolve('supabase/config.toml'), 'utf8');

  if (!/^\s*project_id\s*=\s*"afaq-interiors-crm-s09-local"\s*(?:#.*)?$/m.test(configuration)) {
    throw new Error('The expected dedicated local Supabase project ID was not found.');
  }

  const secret = process.env.SUPABASE_LOCAL_TEST_SECRET_KEY?.trim();

  const publicKey = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )?.trim();

  if (!secret || !publicKey) {
    throw new Error(
      'Set the local test-only secret key and Supabase public key before running integration tests.',
    );
  }

  const options = {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  };

  const admin = createClient(supabaseUrl.origin, secret, options);

  const publicClient = createClient(supabaseUrl.origin, publicKey, options);

  const createdUsers = new Map<string, string>();

  async function createAccount({
    confirmed = true,
    role = 'sales_executive',
  }: {
    confirmed?: boolean;
    role?: RoleKey | null;
  } = {}): Promise<LocalTestAccount> {
    const email = `s09-e2e-${randomUUID()}@example.test`;

    const password = createTestPassword();

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: confirmed,
    });

    if (error || !data.user || data.user.email !== email) {
      throw new Error('Could not create a temporary local authentication account.');
    }

    createdUsers.set(data.user.id, email);

    if (role) {
      const assignment = await admin.rpc('crm_assign_user_role', {
        p_user_id: data.user.id,
        p_role_key: role,
      });

      if (assignment.error) {
        throw new Error(
          'Could not assign the temporary local test role. Check that the Sprint 10 access migration is applied.',
        );
      }
    }

    return {
      id: data.user.id,
      email,
      password,
    };
  }

  async function isEmailConfirmed(id: string) {
    if (!createdUsers.has(id)) {
      throw new Error('Only accounts created by this fixture may be inspected.');
    }

    const { data, error } = await admin.auth.admin.getUserById(id);

    if (error || !data.user) {
      throw new Error('Could not inspect the temporary local account.');
    }

    return Boolean(data.user.email_confirmed_at);
  }

  async function checkPublicSignup() {
    const email = `s09-e2e-${randomUUID()}@example.test`;

    const { data, error } = await publicClient.auth.signUp({
      email,
      password: createTestPassword(),
    });

    if (data.user?.id && data.user.email === email) {
      createdUsers.set(data.user.id, email);
    }

    return {
      errorCode: error?.code ?? null,
      returnedUser: Boolean(data.user),
    };
  }

  async function cleanup() {
    const fixtureIds = [...createdUsers.keys()];
    let failed = false;

    for (const [id, expectedEmail] of createdUsers) {
      const existing = await admin.auth.admin.getUserById(id);

      if (existing.error?.status === 404) {
        createdUsers.delete(id);
        continue;
      }

      if (existing.error || existing.data.user?.email !== expectedEmail) {
        failed = true;
        continue;
      }

      const result = await admin.auth.admin.deleteUser(id);

      if (result.error) {
        failed = true;
      } else {
        createdUsers.delete(id);
      }
    }

    if (failed) {
      throw new Error('Some temporary local authentication accounts could not be cleaned up.');
    }
    // Owner-only cleanup of this fixture's audit evidence, after Auth cascades finish.
    // Existing non-fixture history is retained. No audit deletion RPC is exposed.
    if (fixtureIds.length) {
      if (fixtureIds.some((id) => !/^[0-9a-f-]{36}$/.test(id)))
        throw new Error('Invalid fixture UUID.');
      const ids = fixtureIds.map((id) => `'${id}'`).join(',');
      execFileSync(
        'docker',
        [
          'exec',
          '-i',
          'supabase_db_afaq-interiors-crm-s09-local',
          'psql',
          '-U',
          'postgres',
          '-d',
          'postgres',
          '-X',
          '-v',
          'ON_ERROR_STOP=1',
        ],
        {
          input: `DO $$ BEGIN IF to_regclass('crm_access.role_events') IS NOT NULL THEN DELETE FROM crm_access.role_events WHERE target_user_id IN (${ids}) OR actor_id IN (${ids}); END IF; END $$;`,
          stdio: ['pipe', 'pipe', 'pipe'],
        },
      );
    }
  }

  return {
    createAccount,
    isEmailConfirmed,
    checkPublicSignup,
    cleanup,
  };
}
