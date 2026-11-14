import { Skeleton } from '@/components/ui/skeleton';

export default function QuotationLoading() {
  return (
    <section
      aria-label="Loading quotations"
      aria-busy="true"
      className="mx-auto max-w-7xl space-y-5"
    >
      <p role="status">Loading quotations…</p>
      <Skeleton className="h-12 w-2/3" />
      <Skeleton className="h-64 w-full rounded-card" />
    </section>
  );
}
