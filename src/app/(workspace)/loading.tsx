import { Skeleton } from '@/components/ui/skeleton';

export default function LoadingLeadDetails() {
  return (
    <div role="status" className="space-y-5">
      <p>Loading authorized lead details…</p>
      <Skeleton className="h-12 w-2/3" />
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
