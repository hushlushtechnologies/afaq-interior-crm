import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { AccessUnavailable } from '@/components/access/access-unavailable';
import { WorkspaceAccessDenied } from '@/components/access/workspace-access-denied';
import { PageHeader } from '@/components/layout/page-header';
import { QuotationRevisionCreator } from '@/components/quotations/quotation-revision-creator';
import { buttonClassName } from '@/components/ui/button';
import { hasCapability } from '@/features/access/permissions';
import { getMyAccessState } from '@/features/access/server';
import { loadQuotation } from '@/features/quotations/actions';
import { loadQuotationContext } from '@/features/quotations/queries';

export const instant = false;

export const metadata: Metadata = {
  title: 'Create quotation revision | Afaq Al Manzel',
};

export function generateStaticParams() {
  return [{ quotationId: 'preview-unavailable' }];
}

export default async function CreateRevisionPage({
  params,
}: {
  params: Promise<{ quotationId: string }>;
}) {
  const access = await getMyAccessState();

  if (access.status === 'unavailable') return <AccessUnavailable />;

  if (
    !hasCapability(access.snapshot, 'quotations.view') ||
    !hasCapability(access.snapshot, 'quotations.update')
  )
    return (
      <WorkspaceAccessDenied
        snapshot={access.snapshot}
        workspaceTitle="Create quotation revision"
      />
    );

  const { quotationId } = await params;

  if (!z.uuid().safeParse(quotationId).success) notFound();

  const [record, context] = await Promise.all([
    loadQuotation({ id: quotationId }),
    loadQuotationContext({ leadId: null, quotationId }),
  ]);

  if (record.status === 'error' || context.status === 'error')
    return (
      <div className="space-y-4">
        <PageHeader
          title="Revision unavailable"
          description="Reload after checking your quotation access."
        />

        <p role="alert">The quotation could not be loaded or your access changed.</p>

        <a
          href={`/quotations/${quotationId}/revisions/new`}
          className={buttonClassName({ variant: 'outline' })}
        >
          Retry loading revision form
        </a>
      </div>
    );

  if (!context.data.canEdit)
    return (
      <WorkspaceAccessDenied
        snapshot={access.snapshot}
        workspaceTitle="Create quotation revision"
      />
    );

  return (
    <div className="mx-auto min-w-0 max-w-7xl space-y-6">
      <PageHeader
        title="New quotation revision"
        description="Start from saved commercial information and preserve earlier evidence."
      />

      <QuotationRevisionCreator
        key={`${quotationId}:${record.data.version}`}
        id={quotationId}
        number={record.data.number}
        revision={record.data.revision}
        version={record.data.version}
      />
    </div>
  );
}