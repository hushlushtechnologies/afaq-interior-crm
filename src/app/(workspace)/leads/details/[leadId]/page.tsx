import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { AccessUnavailable } from '@/components/access/access-unavailable';
import { WorkspaceAccessDenied } from '@/components/access/workspace-access-denied';
import { PageHeader } from '@/components/layout/page-header';
import { LeadDetailsPrototype } from '@/components/leads/lead-details-prototype';
import { LeadDetailsWorkspace } from '@/components/leads/lead-details-workspace';
import { LeadActivityTimeline } from '@/components/leads/lead-activity-timeline';
import { LeadManualActivities } from '@/components/leads/lead-manual-activities';
import { LeadFollowUps } from '@/components/leads/lead-follow-ups';
import { LeadAttachments } from '@/components/leads/lead-attachments';
import { LeadQuotations } from '@/components/quotations/lead-quotations';
import { buttonClassName } from '@/components/ui/button';
import { hasCapability } from '@/features/access/permissions';
import { getMyAccessState } from '@/features/access/server';
import { canUseRecordDemo } from '@/features/access/workspace-access';
import { loadLeadDetails } from '@/features/lead-details/actions';
import { loadLeads } from '@/features/leads/actions';
import { getDemoDataset } from '@/lib/demo/crm-fixtures';

export const instant = false;
type Props = { params: Promise<{ leadId: string }> };

export function generateStaticParams() {
  const dataset = getDemoDataset();
  return dataset
    ? dataset.leads.map((lead) => ({ leadId: lead.id }))
    : [{ leadId: 'preview-unavailable' }];
}

export const metadata: Metadata = { title: 'Lead details | Afaq Al Manzel' };

export default async function LeadDetailsRoute({ params }: Props) {
  const access = await getMyAccessState();
  if (access.status === 'unavailable') return <AccessUnavailable />;
  if (!hasCapability(access.snapshot, 'leads.view'))
    return <WorkspaceAccessDenied snapshot={access.snapshot} workspaceTitle="Lead details" />;

  const { leadId } = await params;
  if (!z.uuid().safeParse(leadId).success) {
    if (
      process.env.NODE_ENV === 'development' &&
      canUseRecordDemo(access.snapshot) &&
      getDemoDataset()?.leads.some((lead) => lead.id === leadId)
    )
      return <LeadDetailsPrototype leadId={leadId} />;
    notFound();
  }

  let result = await loadLeads({ id: leadId, page: 0, archived: false });
  if (result.status === 'ok' && result.data.rows.length === 0)
    result = await loadLeads({ id: leadId, page: 0, archived: true });

  if (result.status === 'error')
    return (
      <div className="space-y-5">
        <PageHeader
          title="Lead details unavailable"
          description="Your record access could not be confirmed."
        />
        <p role="alert">{result.message}</p>
        <a href={`/leads/details/${leadId}`} className={buttonClassName({ variant: 'outline' })}>
          Retry loading lead
        </a>
        <Link href="/leads" className={buttonClassName({ variant: 'outline' })}>
          All leads
        </Link>
      </div>
    );

  const lead = result.data.rows[0];
  if (!lead) notFound();

  const [requirements, room, note] = await Promise.all([
    loadLeadDetails({ leadId, kind: 'requirements', page: 0 }),
    loadLeadDetails({ leadId, kind: 'room', page: 0 }),
    loadLeadDetails({ leadId, kind: 'note', page: 0 }),
  ]);

  return (
    <>
      <LeadDetailsWorkspace
        key={`${lead.id}:${lead.version}`}
        lead={lead}
        initial={{ requirements, room, note }}
      />
      <LeadFollowUps key={`follow-ups:${lead.id}:${lead.version}`} lead={lead} />
      <LeadManualActivities key={`activities:${lead.id}`} leadId={lead.id} />
      <LeadActivityTimeline key={`timeline:${lead.id}`} leadId={lead.id} />
      <LeadAttachments key={`attachments:${lead.id}`} lead={lead} />
      <LeadQuotations key={`quotations:${lead.id}`} leadId={lead.id} />
    </>
  );
}
