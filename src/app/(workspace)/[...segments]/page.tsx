import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SecurityAuditWorkspace } from '@/components/access/security-audit-workspace';
import { AccessUnavailable } from '@/components/access/access-unavailable';
import { RoleManagementWorkspace } from '@/components/access/role-management-workspace';
import { WorkspaceAccessDenied } from '@/components/access/workspace-access-denied';
import { LeadReportWorkspace } from '@/components/dashboard/lead-report-workspace';
import { defaultReportRange } from '@/features/lead-reports/contracts';
import { loadLeadReport } from '@/features/lead-reports/service';
import { DashboardPrototype } from '@/components/dashboard/dashboard-prototype';
import { EmployeeInvitationWorkspace } from '@/components/employees/employee-invitation-workspace';
import { EmployeeDirectoryWorkspace } from '@/components/employees/employee-directory-workspace';
import { loadEmployeeDirectory } from '@/features/employee/directory-actions';
import { LeadImportWorkspace } from '@/components/leads/lead-import-workspace';
import { hasRequiredScope } from '@/features/access/permissions';
import { FollowUpWorkspace } from '@/components/leads/follow-up-workspace';
import { loadFollowUps } from '@/features/follow-ups/actions';
import { LeadsWorkspace } from '@/components/leads/leads-workspace';
import { LeadRecordWorkspace } from '@/components/leads/lead-record-workspace';
import { queryLeads } from '@/features/leads/query-actions';
import { loadLeadOptions } from '@/features/leads/actions';
import { WorkspacePlaceholder } from '@/components/workspace/workspace-placeholder';
import { getMyAccessState } from '@/features/access/server';
import { canOpenWorkspacePage, canUseRecordDemo } from '@/features/access/workspace-access';
import { getWorkspacePage, getWorkspaceStaticParams } from '@/lib/workspace/navigation';

export const instant = false;

type WorkspaceRouteProps = {
  searchParams: Promise<{
    preview?: string;
    batchId?: string;
    from?: string | string[];
    to?: string | string[];
  }>;
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

export default async function WorkspaceRoute({ params, searchParams }: WorkspaceRouteProps) {
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

  if (page.module.id === 'leads' && page.section.slug === 'follow-ups') {
    return (
      <FollowUpWorkspace
        initial={await loadFollowUps({ leadId: null, page: 0, view: 'today', mine: true })}
      />
    );
  }

  if (page.module.id === 'leads' && page.section.slug === 'imports') {
    const result = await loadLeadOptions();
    const initial =
      result.status === 'ok' && !hasRequiredScope(access.snapshot, 'leads.assign', 'company')
        ? {
            ...result,
            data: {
              ...result.data,
              owners: result.data.owners.filter((owner) => owner.id === access.snapshot.userId),
            },
          }
        : result;
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Dubai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const batchId = (await searchParams).batchId;
    return (
      <LeadImportWorkspace
        initial={initial}
        today={today}
        initialBatchId={typeof batchId === 'string' ? batchId : ''}
      />
    );
  }

  const isDashboard = page.module.id === 'dashboard' && page.section.slug === '';

  const isLeadList =
    page.module.id === 'leads' && (page.section.slug === '' || page.section.slug === 'pipeline');

  const recordDemoAllowed =
    process.env.NODE_ENV === 'development' && canUseRecordDemo(access.snapshot);

  if (isDashboard && recordDemoAllowed && (await searchParams).preview === '1') {
    return <DashboardPrototype />;
  }

  if (isDashboard || (page.module.id === 'reports' && page.section.slug === 'sales')) {
    const query = await searchParams;
    const defaults = defaultReportRange(new Date());
    const range = {
      from: typeof query.from === 'string' ? query.from : defaults.from,
      to: typeof query.to === 'string' ? query.to : defaults.to,
    };
    const mode = isDashboard ? 'dashboard' : 'report';
    // Repeated date parameters are invalid, rather than silently taking one value.
    const input = Array.isArray(query.from) || Array.isArray(query.to) ? null : range;
    return (
      <LeadReportWorkspace initial={await loadLeadReport(input, mode)} range={range} mode={mode} />
    );
  }

  if (isLeadList && recordDemoAllowed && (await searchParams).preview === '1') {
    return (
      <LeadsWorkspace
        key={page.href}
        title={page.title}
        initialView={page.section.slug === 'pipeline' ? 'kanban' : 'table'}
      />
    );
  }

  if (isLeadList) {
    const [initial, initialOptions] = await Promise.all([queryLeads({}), loadLeadOptions()]);

    return (
      <LeadRecordWorkspace
        key={page.href}
        initial={initial}
        initialOptions={initialOptions}
        initialView={page.section.slug === 'pipeline' ? 'kanban' : 'table'}
      />
    );
  }

  return <WorkspacePlaceholder page={page} />;
}