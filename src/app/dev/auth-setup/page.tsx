import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { DetailSection } from '@/components/layout/detail-section';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { InlineNotice } from '@/components/ui/inline-notice';
import { PageContainer } from '@/components/ui/page-container';
import { getSupabasePublicConfig } from '@/lib/supabase/public-config';
import { getApplicationOrigin } from '@/lib/supabase/server-config';

export const metadata: Metadata = {
  title: 'Authentication setup | Afaq Al Manzel',
  description: 'Development-only authentication setup check.',
};

type AuthSetupCheck =
  | {
      state: 'configuration-error';
    }
  | {
      state: 'unreachable';
    }
  | {
      state: 'http-error';
      status: number;
    }
  | {
      state: 'ready';
      applicationOrigin: string;
      endpoint: string;
    };

async function checkAuthSetup(): Promise<AuthSetupCheck> {
  let config: ReturnType<typeof getSupabasePublicConfig>;
  let applicationOrigin: string;

  try {
    config = getSupabasePublicConfig();
    applicationOrigin = getApplicationOrigin();
  } catch {
    return {
      state: 'configuration-error',
    };
  }

  try {
    const response = await fetch(`${config.url}/auth/v1/health`, {
      headers: {
        apikey: config.publishableKey,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
    });

    if (!response.ok) {
      return {
        state: 'http-error',
        status: response.status,
      };
    }

    return {
      state: 'ready',
      applicationOrigin,
      endpoint: config.url,
    };
  } catch {
    return {
      state: 'unreachable',
    };
  }
}

async function AuthSetupStatus() {
  const result = await checkAuthSetup();

  if (result.state === 'configuration-error') {
    return (
      <InlineNotice title="Configuration needs attention" tone="warning">
        <p>
          Check NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, and APP_URL in
          .env.local. Restart the Next.js development server after changing them.
        </p>
      </InlineNotice>
    );
  }

  if (result.state === 'unreachable') {
    return (
      <InlineNotice title="Cannot reach Supabase Auth" tone="warning">
        <p>
          Check that Docker Desktop is running and that supabase start completed successfully.
          Confirm the endpoint in .env.local, then reload this page.
        </p>
      </InlineNotice>
    );
  }

  if (result.state === 'http-error') {
    return (
      <InlineNotice title="Supabase Auth did not pass the health check" tone="warning">
        <p>
          The service returned HTTP {result.status}. Check the local stack and the public key copied
          into .env.local.
        </p>
      </InlineNotice>
    );
  }

  return (
    <div className="space-y-5">
      <InlineNotice title="Supabase Auth is reachable" tone="success">
        <p>
          The authentication service responded successfully. This checks connectivity; it does not
          sign in an employee.
        </p>
      </InlineNotice>

      <dl className="grid min-w-0 gap-5 sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">Application origin</dt>

          <dd className="mt-1 break-all text-sm font-medium">{result.applicationOrigin}</dd>
        </div>

        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">Supabase endpoint</dt>

          <dd className="mt-1 break-all text-sm font-medium">{result.endpoint}</dd>
        </div>
      </dl>
    </div>
  );
}

export default function AuthSetupPage() {
  if (process.env.NODE_ENV !== 'development') {
    notFound();
  }

  return (
    <PageContainer>
      <div className="space-y-6 py-8">
        <PageHeader
          title="Authentication setup"
          description="Local Supabase connectivity and configuration."
          actions={<Badge tone="warning">Development preview</Badge>}
        />

        <DetailSection
          id="auth-connectivity"
          title="Service check"
          description="Checks configuration and the Supabase Auth health endpoint."
        >
          <Suspense
            fallback={
              <InlineNotice title="Checking Supabase Auth" tone="info">
                <p>Waiting for the service response.</p>
              </InlineNotice>
            }
          >
            <AuthSetupStatus />
          </Suspense>
        </DetailSection>

        <InlineNotice title="Sprint 09 foundation" tone="info">
          <p>
            Login, logout, protected routes, and session refresh will be connected in the next part.
          </p>
        </InlineNotice>
      </div>
    </PageContainer>
  );
}
