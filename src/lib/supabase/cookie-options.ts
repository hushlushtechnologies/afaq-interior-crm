export const SUPABASE_AUTH_COOKIE_NAME = 'afaq-interiors-crm-auth';

export function getSupabaseCookieOptions(secure: boolean) {
  return {
    name: SUPABASE_AUTH_COOKIE_NAME,
    path: '/',
    sameSite: 'lax' as const,
    secure,
  };
}
