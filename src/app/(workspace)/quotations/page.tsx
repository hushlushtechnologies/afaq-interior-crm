import type { Metadata } from 'next';
import { AccessUnavailable } from '@/components/access/access-unavailable';
import { WorkspaceAccessDenied } from '@/components/access/workspace-access-denied';
import { PageHeader } from '@/components/layout/page-header';
import { QuotationList } from '@/components/quotations/quotation-list';
import { hasCapability } from '@/features/access/permissions';
import { getMyAccessState } from '@/features/access/server';
import { loadQuotationPage } from '@/features/quotations/queries';
import { quotationQuerySchema } from '@/features/quotations/query-contracts';
import { quotationViewKey } from '@/features/quotations/server-render';

export const instant = false;
export const metadata: Metadata = { title: 'Quotations | Afaq Al Manzel' };

export default async function QuotationsPage() {
  const access = await getMyAccessState();
  if (access.status === 'unavailable') return <AccessUnavailable />;
  if (!hasCapability(access.snapshot, 'quotations.view'))
    return <WorkspaceAccessDenied snapshot={access.snapshot} workspaceTitle="Quotations" />;

  const query = quotationQuerySchema.parse({});
  const initial = await loadQuotationPage(query);

  return (
    <div className="mx-auto min-w-0 max-w-7xl space-y-6">
      <PageHeader
        title="Quotations"
        description="Prepare and manage lead-linked draft quotations."
      />
      <QuotationList
        key={quotationViewKey(initial)}
        initial={initial}
        query={query}
        createHref={
          hasCapability(access.snapshot, 'quotations.create') &&
          hasCapability(access.snapshot, 'leads.view')
            ? '/leads'
            : undefined
        }
      />
    </div>
  );
}
