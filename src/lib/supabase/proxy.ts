import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isAuthServiceFailure } from '@/features/auth/errors';
import { getSupabaseCookieOptions, SUPABASE_AUTH_COOKIE_NAME } from '@/lib/supabase/cookie-options';
import { getSupabasePublicConfig, isSupportedHttpOrigin } from '@/lib/supabase/public-config';
import { WORKSPACE_MODULES } from '@/lib/workspace/navigation';

const workspaceRoots = new Set<string>(
  WORKSPACE_MODULES.map((workspaceModule) => workspaceModule.id),
);

function isWorkspacePath(pathname: string): boolean {
  if (pathname === '/') {
    return true;
  }

  const root = pathname.split('/').filter(Boolean)[0];

  return workspaceRoots.has(root ?? '');
}

function preventResponseCaching(response: NextResponse) {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');

  response.headers.set('CDN-Cache-Control', 'no-store');

  return response;
}

export async function updateSupabaseSession(request: NextRequest) {
  let config: ReturnType<typeof getSupabasePublicConfig>;
  let secure: boolean;

  try {
    config = getSupabasePublicConfig();

    const applicationUrl = process.env.APP_URL;

    if (!applicationUrl || !isSupportedHttpOrigin(applicationUrl)) {
      throw new Error('Invalid application configuration.');
    }

    secure = new URL(applicationUrl).protocol === 'https:';
  } catch {
    return preventResponseCaching(
      new NextResponse('Authentication configuration is unavailable.', {
        status: 503,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        },
      }),
    );
  }

  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(config.url, config.publishableKey, {
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
        return request.cookies.getAll();
      },

      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }

        const previousCookies = response.cookies.getAll();

        response = NextResponse.next({
          request,
        });

        for (const cookie of previousCookies) {
          response.cookies.set(cookie);
        }

        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  let authenticated = false;
  let verificationUnavailable = false;

  try {
    const { data, error } = await supabase.auth.getUser();

    authenticated = Boolean(!error && data.user?.email && data.user.email_confirmed_at);

    verificationUnavailable = Boolean(error && isAuthServiceFailure(error));
  } catch {
    verificationUnavailable = true;
  }

  const isPageRequest = request.method === 'GET' || request.method === 'HEAD';

  if (
    isPageRequest &&
    isWorkspacePath(request.nextUrl.pathname) &&
    !authenticated &&
    !verificationUnavailable
  ) {
    const redirectResponse = NextResponse.redirect(new URL('/login', request.url));

    for (const cookie of response.cookies.getAll()) {
      redirectResponse.cookies.set(cookie);
    }

    return preventResponseCaching(redirectResponse);
  }

  return preventResponseCaching(response);
}
