import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SecurityAuditWorkspace } from '@/components/access/security-audit-workspace';
import { AccessOverview } from '@/components/access/access-overview';
import { AccessUnavailable } from '@/components/access/access-unavailable';
import { RoleManagementWorkspace } from '@/components/access/role-management-workspace';
import { WorkspaceAccessDenied } from '@/components/access/workspace-access-denied';
import { DashboardPrototype } from '@/components/dashboard/dashboard-prototype';
import { EmployeeInvitationWorkspace } from '@/components/employees/employee-invitation-workspace';
import { EmployeeDirectoryWorkspace } from '@/components/employees/employee-directory-workspace';
import { loadEmployeeDirectory } from '@/features/employee/directory-actions';
import { LeadsWorkspace } from '@/components/leads/leads-workspace';
import { WorkspacePlaceholder } from '@/components/workspace/workspace-placeholder';
import { getMyAccessState } from '@/features/access/server';
import { canOpenWorkspacePage, canUseRecordDemo } from '@/features/access/workspace-access';
import { getWorkspacePage, getWorkspaceStaticParams } from '@/lib/workspace/navigation';

export const instant = false;

type WorkspaceRouteProps = {
  params: Promise<{
    segments: string[];
  }>;
};

export function generateStaticParams() {
  return getWorkspaceStaticParams();
}

export async function generateMetadata({ params }: WorkspaceRouteProps): Promise<Metadata> {
  const { segments } = await params;
  const page = getWorkspacePage(segments);

  if (!page) {
    notFound();
  }

  return {
    title: `${page.title} | Afaq Al Manzel`,
    description: page.module.description,
  };
}

export default async function WorkspaceRoute({ params }: WorkspaceRouteProps) {
  const { segments } = await params;
  const page = getWorkspacePage(segments);

  if (!page) {
    notFound();
  }

  const access = await getMyAccessState();

  if (access.status === 'unavailable') {
    return <AccessUnavailable />;
  }

  if (!canOpenWorkspacePage(access.snapshot, page)) {
    return <WorkspaceAccessDenied snapshot={access.snapshot} workspaceTitle={page.title} />;
  }

  if (page.module.id === 'settings' && page.section.slug === 'access') {
    return (
      <div className="space-y-6">
        <RoleManagementWorkspace />
        <SecurityAuditWorkspace />
      </div>
    );
  }

  if (page.module.id === 'employees' && page.section.slug === 'invitations') {
    return <EmployeeInvitationWorkspace />;
  }

  if (page.module.id === 'employees' && page.section.slug === '') {
    return (
      <EmployeeDirectoryWorkspace initial={await loadEmployeeDirectory({ search: '', page: 0 })} />
    );
  }

  const isDashboard = page.module.id === 'dashboard' && page.section.slug === '';

  const isLeadList =
    page.module.id === 'leads' && (page.section.slug === '' || page.section.slug === 'pipeline');

  const recordDemoAllowed =
    process.env.NODE_ENV === 'development' && canUseRecordDemo(access.snapshot);

  if (isDashboard) {
    return recordDemoAllowed ? (
      <DashboardPrototype />
    ) : (
      <AccessOverview snapshot={access.snapshot} />
    );
  }

  if (isLeadList && recordDemoAllowed) {
    return (
      <LeadsWorkspace
        key={page.href}
        title={page.title}
        initialView={page.section.slug === 'pipeline' ? 'kanban' : 'table'}
      />
    );
  }

  return <WorkspacePlaceholder page={page} />;
}