import { Suspense, type ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { AccessProvider } from '@/components/access/access-provider';
import { AccessUnavailable } from '@/components/access/access-unavailable';
import { AccountToolbar } from '@/components/auth/account-toolbar';
import { AuthPanel } from '@/components/auth/auth-panel';
import { AuthUnavailable } from '@/components/auth/auth-unavailable';
import { DemoCrmProvider } from '@/components/demo/demo-crm-provider';
import { AppShell } from '@/components/shell/app-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getMyAccessState } from '@/features/access/server';
import { canUseRecordDemo } from '@/features/access/workspace-access';
import { getAuthState } from '@/features/auth/session';
import { getDemoDataset } from '@/lib/demo/crm-fixtures';
import type { WorkspaceUser } from '@/types/workspace';

async function AuthenticatedWorkspace({ children }: { children: ReactNode }) {
  await connection();

  const auth = await getAuthState();

  if (auth.status === 'anonymous') {
    redirect('/login');
  }

  if (auth.status === 'unavailable') {
    return <AuthUnavailable />;
  }

  let employmentStatus: unknown = null;
  try {
    const client = await createSupabaseServerClient();
    const status = await client.rpc('crm_get_my_employee_status');
    if (!status.error) employmentStatus = status.data;
  } catch {
    // Leave the status unknown and render the fail-closed state below.
  }
  if (employmentStatus === 'inactive' || employmentStatus === 'invited') {
    return (
      <AuthPanel
        title={employmentStatus === 'inactive' ? 'Account inactive' : 'Account not active'}
        description="Contact your administrator to review your employee account status."
      >
        <AccountToolbar email={auth.user.email} />
      </AuthPanel>
    );
  }
  if (employmentStatus !== 'active') return <AccessUnavailable email={auth.user.email} />;

  const access = await getMyAccessState();

  if (access.status === 'unavailable') {
    return <AccessUnavailable email={auth.user.email} />;
  }

  const user: WorkspaceUser = {
    id: auth.user.id,
    name: auth.user.email.split('@')[0] || 'Employee',
    email: auth.user.email,
    label: 'Authenticated employee',
    mode: 'authenticated',
  };

  const shell = (
    <AccessProvider snapshot={access.snapshot}>
      <AppShell user={user}>
        <div className="min-w-0 space-y-6">
          <AccountToolbar email={user.email} />
          {children}
        </div>
      </AppShell>
    </AccessProvider>
  );

  const demoData = canUseRecordDemo(access.snapshot) ? getDemoDataset() : null;

  if (!demoData) {
    return shell;
  }

  return <DemoCrmProvider initialData={demoData}>{shell}</DemoCrmProvider>;
}

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <AuthPanel
          title="Checking workspace access"
          description="Please wait while we verify your account."
        >
          <Skeleton className="h-32 w-full" />
        </AuthPanel>
      }
    >
      <AuthenticatedWorkspace>{children}</AuthenticatedWorkspace>
    </Suspense>
  );
}