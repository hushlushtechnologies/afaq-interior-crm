import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { DemoPreviewState } from '@/types/demo-crm';

export function DemoStatePanel({
  state,
  onRetry,
}: {
  state: DemoPreviewState;
  onRetry: () => void;
}) {
  if (state === 'ready') {
    return null;
  }

  if (state === 'loading') {
    return (
      <section aria-label="Loading example" aria-busy="true" className="space-y-5">
        <span role="status" className="sr-only">
          Demonstration loading state
        </span>

        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-36 rounded-card" />
          ))}
        </div>

        <Skeleton className="h-72 rounded-card" />
      </section>
    );
  }

  const isError = state === 'error';

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isError ? 'Preview unavailable' : 'No demo records to display'}</CardTitle>

        <CardDescription>
          {isError
            ? 'This is a simulated error state. No backend request failed.'
            : 'This demonstrates how an empty workspace will appear.'}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Button variant="outline" onClick={onRetry}>
          {isError ? 'Retry preview' : 'Show sample data'}
        </Button>
      </CardContent>
    </Card>
  );
}
