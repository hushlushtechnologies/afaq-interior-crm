import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AccessUnavailable } from '@/components/access/access-unavailable';
import { WorkspaceAccessDenied } from '@/components/access/workspace-access-denied';
import { PageHeader } from '@/components/layout/page-header';
import { LeadDetailsPrototype } from '@/components/leads/lead-details-prototype';
import { buttonClassName } from '@/components/ui/button';
import { InlineNotice } from '@/components/ui/inline-notice';
import { hasCapability } from '@/features/access/permissions';
import { getMyAccessState } from '@/features/access/server';
import { canUseRecordDemo } from '@/features/access/workspace-access';
import { getDemoDataset } from '@/lib/demo/crm-fixtures';

export const instant = false;

type LeadDetailsRouteProps = {
  params: Promise<{
    leadId: string;
  }>;
};

export function generateStaticParams() {
  const dataset = getDemoDataset();

  return dataset
    ? dataset.leads.map((lead) => ({
        leadId: lead.id,
      }))
    : [{ leadId: 'preview-unavailable' }];
}

async function requireDemoLead(params: LeadDetailsRouteProps['params']) {
  const dataset = getDemoDataset();

  if (!dataset) {
    notFound();
  }

  const { leadId } = await params;

  const lead = dataset.leads.find((item) => item.id === leadId);

  if (!lead) {
    notFound();
  }

  return lead;
}

export async function generateMetadata({ params }: LeadDetailsRouteProps): Promise<Metadata> {
  if (process.env.NODE_ENV !== 'development') {
    notFound();
  }

  const access = await getMyAccessState();

  if (
    access.status === 'unavailable' ||
    !hasCapability(access.snapshot, 'leads.view') ||
    !canUseRecordDemo(access.snapshot)
  ) {
    return {
      title: 'Lead details | Afaq Al Manzel',
    };
  }

  const lead = await requireDemoLead(params);

  return {
    title: `${lead.clientName} | Afaq Al Manzel`,
    description: 'Development-only lead details.',
  };
}

export default async function LeadDetailsRoute({ params }: LeadDetailsRouteProps) {
  if (process.env.NODE_ENV !== 'development') {
    notFound();
  }

  const access = await getMyAccessState();

  if (access.status === 'unavailable') {
    return <AccessUnavailable />;
  }

  if (!hasCapability(access.snapshot, 'leads.view')) {
    return <WorkspaceAccessDenied snapshot={access.snapshot} workspaceTitle="Lead details" />;
  }

  if (!canUseRecordDemo(access.snapshot)) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Lead details"
          description="This sample is not available in your current workspace view."
        />

        <InlineNotice title="Use your permitted lead list" tone="info">
          <p>Open a record from the lead list available to your account.</p>
        </InlineNotice>

        <Link
          href="/leads"
          className={buttonClassName({
            variant: 'outline',
          })}
        >
          All leads
        </Link>
      </div>
    );
  }

  const lead = await requireDemoLead(params);

  return <LeadDetailsPrototype leadId={lead.id} />;
}
