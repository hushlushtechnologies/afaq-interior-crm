import { hasCapability } from '@/features/access/permissions';
import { getMyAccessState } from '@/features/access/server';
import { loadQuotationContext, loadQuotationPage } from '@/features/quotations/queries';
import { quotationQuerySchema } from '@/features/quotations/query-contracts';
import { quotationViewKey } from '@/features/quotations/server-render';
import { QuotationList } from './quotation-list';

export async function LeadQuotations({ leadId }: { leadId: string }) {
  const access = await getMyAccessState();
  if (access.status !== 'ready' || !hasCapability(access.snapshot, 'quotations.view')) return null;

  const query = quotationQuerySchema.parse({ leadId });
  const [initial, context] = await Promise.all([
    loadQuotationPage(query),
    loadQuotationContext({ leadId, quotationId: null }),
  ]);

  return (
    <div className="mx-auto min-w-0 max-w-7xl">
      <QuotationList
        key={quotationViewKey(initial)}
        initial={initial}
        query={query}
        createHref={context.status === 'ok' && context.data.canCreate
          ? `/quotations/new?leadId=${leadId}`
          : undefined}
      />
    </div>
  );
}