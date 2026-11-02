import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { DetailSection } from '@/components/layout/detail-section';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { InlineNotice } from '@/components/ui/inline-notice';
import { PageContainer } from '@/components/ui/page-container';
import { Skeleton } from '@/components/ui/skeleton';
import { PERMISSION_LABELS, ROLE_LABELS } from '@/features/access/catalog';
import { getMyAccess } from '@/features/access/server';
import { focusRing } from '@/lib/utils';

export const instant = false;

export const metadata: Metadata = {
  title: 'Access setup | Afaq Al Manzel',
  description: 'Development-only database access inspection.',
};

async function AccessSetupContent() {
  const snapshot = await getMyAccess();

  return (
    <div className="space-y-6">
      <DetailSection
        id="current-access"
        title="Current access"
        description="Loaded from the database for the authenticated account."
      >
        <dl className="space-y-4">
          <div>
            <dt className="text-xs text-muted-foreground">Account ID</dt>

            <dd className="mt-1 break-all text-sm font-medium">{snapshot.userId}</dd>
          </div>

          <div>
            <dt className="text-xs text-muted-foreground">Employee roles</dt>

            <dd className="mt-2">
              {snapshot.roles.length ? (
                <div className="flex flex-wrap gap-2">
                  {snapshot.roles.map((role) => (
                    <Badge key={role} tone="info">
                      {ROLE_LABELS[role]}
                    </Badge>
                  ))}
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">No roles assigned</span>
              )}
            </dd>
          </div>

          <div>
            <dt className="text-xs text-muted-foreground">Effective grants</dt>

            <dd className="mt-1 text-lg font-semibold">{snapshot.grants.length}</dd>
          </div>
        </dl>
      </DetailSection>

      {!snapshot.roles.length ? (
        <InlineNotice title="Role assignment required" tone="warning">
          <p>This account has no employee roles. A Super Admin must assign the appropriate role.</p>
        </InlineNotice>
      ) : null}

      <DetailSection
        id="permission-grants"
        title="Permission grants"
        description="Company scope covers own and assigned scope. Own and assigned scopes remain distinct."
      >
        <div
          role="region"
          aria-label="Scrollable permission grants"
          tabIndex={0}
          className={`min-w-0 overflow-x-auto rounded-control border border-border ${focusRing}`}
        >
          <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
            <caption className="sr-only">Effective database permission grants</caption>

            <thead className="bg-muted">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Permission
                </th>
                <th scope="col" className="px-4 py-3">
                  Scope
                </th>
              </tr>
            </thead>

            <tbody>
              {snapshot.grants.length ? (
                snapshot.grants.map((grant) => (
                  <tr key={`${grant.permission}:${grant.scope}`} className="border-t border-border">
                    <td className="px-4 py-3">
                      <p className="font-medium">{PERMISSION_LABELS[grant.permission]}</p>

                      <p className="mt-1 text-xs text-muted-foreground">{grant.permission}</p>
                    </td>

                    <td className="px-4 py-3">
                      <Badge tone="outline">{grant.scope}</Badge>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={2} className="px-4 py-6 text-muted-foreground">
                    No permissions are assigned.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </DetailSection>
    </div>
  );
}

export default function AccessSetupPage() {
  if (process.env.NODE_ENV !== 'development') {
    notFound();
  }

  return (
    <PageContainer>
      <div className="space-y-6 py-8">
        <PageHeader
          title="Access setup"
          description="Inspect the current account's database-backed roles."
          actions={<Badge tone="warning">Development preview</Badge>}
        />

        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <AccessSetupContent />
        </Suspense>
      </div>
    </PageContainer>
  );
}
