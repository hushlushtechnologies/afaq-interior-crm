import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { AccessUnavailable } from '@/components/access/access-unavailable';
import { WorkspaceAccessDenied } from '@/components/access/workspace-access-denied';
import { PageHeader } from '@/components/layout/page-header';
import { QuotationBuilder } from '@/components/quotations/quotation-builder';
import { QuotationHistory } from '@/components/quotations/quotation-history';
import { WorkspacePlaceholder } from '@/components/workspace/workspace-placeholder';
import { buttonClassName } from '@/components/ui/button';
import { hasCapability } from '@/features/access/permissions';
import { getMyAccessState } from '@/features/access/server';
import { canOpenWorkspacePage } from '@/features/access/workspace-access';
import { loadQuotation } from '@/features/quotations/actions';
import { loadQuotationContext } from '@/features/quotations/queries';
import { loadQuotationHistory } from '@/features/quotations/history-actions';
import { currentDubaiQuotationDate } from '@/features/quotations/server-render';
import { getWorkspacePage } from '@/lib/workspace/navigation';

export const instant = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { quotationId } = await params;
  const existing = getWorkspacePage(['quotations', quotationId]);

  return { title: `${existing?.title ?? 'Quotation draft'} | Afaq Al Manzel` };
}

export function generateStaticParams() {
  return ['preview-unavailable', 'approvals', 'templates'].map((quotationId) => ({ quotationId }));
}

type Props = {
  params: Promise<{ quotationId: string }>;
  searchParams: Promise<{ leadId?: string | string[] }>;
};

export default async function QuotationPage({ params, searchParams }: Props) {
  const access = await getMyAccessState();

  if (access.status === 'unavailable') return <AccessUnavailable />;

  if (!hasCapability(access.snapshot, 'quotations.view'))
    return <WorkspaceAccessDenied snapshot={access.snapshot} workspaceTitle="Quotation" />;

  const { quotationId } = await params;

  if (quotationId === 'approvals' || quotationId === 'templates') {
    const existing = getWorkspacePage(['quotations', quotationId]);

    if (!existing) notFound();

    return canOpenWorkspacePage(access.snapshot, existing) ? (
      <WorkspacePlaceholder page={existing} />
    ) : (
      <WorkspaceAccessDenied snapshot={access.snapshot} workspaceTitle={existing.title} />
    );
  }

  const leadId = (await searchParams).leadId;
  const creating = quotationId === 'new';

  if (creating ? !z.uuid().safeParse(leadId).success : !z.uuid().safeParse(quotationId).success)
    notFound();

  const [context, record] = await Promise.all([
    loadQuotationContext({
      leadId: creating ? leadId : null,
      quotationId: creating ? null : quotationId,
    }),
    creating ? Promise.resolve(null) : loadQuotation({ id: quotationId }),
  ]);

  if (context.status === 'error' || record?.status === 'error')
    return (
      <div className="space-y-4">
        <PageHeader
          title="Quotation unavailable"
          description="The quotation could not be loaded or your access has changed."
        />

        <p role="alert">
          {context.status === 'error'
            ? context.message
            : record?.status === 'error'
              ? record.message
              : 'Please reload.'}
        </p>

        <a
          href={creating ? `/quotations/new?leadId=${leadId}` : `/quotations/${quotationId}`}
          className={buttonClassName({ variant: 'outline' })}
        >
          Retry loading quotation
        </a>

        <Link href="/quotations" className={buttonClassName({ variant: 'outline' })}>
          All quotations
        </Link>
      </div>
    );

  if (creating && !context.data.canCreate)
    return (
      <WorkspaceAccessDenied
        snapshot={access.snapshot}
        workspaceTitle="Create quotation for this lead"
      />
    );

  const today = currentDubaiQuotationDate();

  const history =
    record?.status === 'ok' ? await loadQuotationHistory({ id: record.data.id, page: 0 }) : null;

  return (
    <>
      <QuotationBuilder
        key={`${quotationId}:${record?.status === 'ok' ? record.data.version : 'new'}`}
        context={context.data}
        record={record?.status === 'ok' ? record.data : null}
        today={today}
      />

      {record?.status === 'ok' && context.data.canEdit && (
        <div className="mx-auto my-4 max-w-7xl">
          <a
            href={`/quotations/${record.data.id}/revisions/new`}
            className={buttonClassName({ variant: 'outline' })}
          >
            Create next commercial revision
          </a>
        </div>
      )}

      {record?.status === 'ok' && history && (
        <QuotationHistory
          key={`history:${record.data.id}:${record.data.version}`}
          id={record.data.id}
          initial={history}
        />
      )}
    </>
  );
}