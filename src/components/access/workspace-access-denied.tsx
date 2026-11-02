import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { buttonClassName } from '@/components/ui/button';
import { InlineNotice } from '@/components/ui/inline-notice';
import type { AccessSnapshot } from '@/features/access/types';
import { getVisibleWorkspaceModules } from '@/features/access/workspace-access';
import { workspaceHref } from '@/lib/workspace/navigation';

export function WorkspaceAccessDenied({
  snapshot,
  workspaceTitle,
}: {
  snapshot: AccessSnapshot;
  workspaceTitle: string;
}) {
  const firstAvailable = getVisibleWorkspaceModules(snapshot)[0];

  const hasRoles = snapshot.roles.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={hasRoles ? 'Access not available' : 'Access not configured'}
        description={
          hasRoles
            ? `Your account does not have access to ${workspaceTitle}.`
            : 'Your account needs an employee role before workspaces can open.'
        }
      />

      <InlineNotice
        title={hasRoles ? 'Contact your Super Admin' : 'Role assignment required'}
        tone="warning"
      >
        <p>Ask your Super Admin to review the roles assigned to your account.</p>
      </InlineNotice>

      {firstAvailable ? (
        <Link
          href={workspaceHref(firstAvailable.id)}
          className={buttonClassName({
            variant: 'outline',
          })}
        >
          Open an available workspace
        </Link>
      ) : null}
    </div>
  );
}
