'use client';

import { createBrowserClient } from '@supabase/ssr';
import { getSupabaseCookieOptions, SUPABASE_AUTH_COOKIE_NAME } from '@/lib/supabase/cookie-options';
import { getSupabasePublicConfig } from '@/lib/supabase/public-config';

export function createSupabaseBrowserClient() {
  const config = getSupabasePublicConfig();

  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:';

  return createBrowserClient(config.url, config.publishableKey, {
    auth: {
      storageKey: SUPABASE_AUTH_COOKIE_NAME,
    },
    cookieOptions: getSupabaseCookieOptions(secure),
  });
}
