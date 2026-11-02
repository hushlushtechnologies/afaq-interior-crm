import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseCookieOptions, SUPABASE_AUTH_COOKIE_NAME } from '@/lib/supabase/cookie-options';
import { getSupabasePublicConfig } from '@/lib/supabase/public-config';
import { getSecureAuthCookieSetting } from '@/lib/supabase/server-config';

async function createRequestClient(canWriteCookies: boolean) {
  const config = getSupabasePublicConfig();
  const cookieStore = await cookies();
  const secure = getSecureAuthCookieSetting();

  return createServerClient(config.url, config.publishableKey, {
    auth: {
      storageKey: SUPABASE_AUTH_COOKIE_NAME,
    },

    cookieOptions: getSupabaseCookieOptions(secure),

    global: {
      fetch(input, init) {
        return fetch(input, {
          ...init,
          cache: 'no-store',
        });
      },
    },

    cookies: {
      getAll() {
        return cookieStore.getAll();
      },

      setAll(cookiesToSet) {
        if (!canWriteCookies) {
          return;
        }

        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
      },
    },
  });
}

export async function createSupabaseServerClient() {
  return createRequestClient(false);
}

export async function createSupabaseMutationClient() {
  return createRequestClient(true);
}
