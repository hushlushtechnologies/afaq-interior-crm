import { Skeleton } from '@/components/ui/skeleton';

export default function WorkspaceLoading() {
  return (
    <section
      aria-label="Loading workspace"
      aria-busy="true"
      className="mx-auto max-w-7xl space-y-6"
    >
      <span role="status" className="sr-only">
        Loading workspace
      </span>

      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-10 w-3/4 max-w-md" />
      <Skeleton className="h-5 w-full max-w-xl" />
      <Skeleton className="h-64 w-full rounded-card" />
    </section>
  );
}
