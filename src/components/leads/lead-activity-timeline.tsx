'use client';

import { startTransition, useEffect, useRef, useState } from 'react';
import { DetailSection } from '@/components/layout/detail-section';
import { Button } from '@/components/ui/button';
import { loadLeadTimeline } from '@/features/lead-timeline/actions';
import type { TimelinePage } from '@/features/lead-timeline/contracts';
import type { Result } from '@/features/leads/schemas';

const time = (value: string) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dubai',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));

function Evidence({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span>Not recorded</span>;

  if (typeof value !== 'object')
    return <span className="whitespace-pre-wrap break-words">{String(value)}</span>;

  if (Array.isArray(value)) return <span>{value.map(String).join(', ')}</span>;

  return (
    <dl className="space-y-2">
      {Object.entries(value)
        .filter(([key]) => !['id', 'lead_id', 'version', 'completed_activity_id'].includes(key))
        .map(([key, item]) => (
          <div key={key} className="border-l border-border pl-3">
            <dt className="font-medium">{key.replaceAll('_', ' ')}</dt>
            <dd>
              <Evidence value={item} />
            </dd>
          </div>
        ))}
    </dl>
  );
}

export function LeadActivityTimeline({ leadId }: { leadId: string }) {
  const [result, setResult] = useState<Result<TimelinePage> | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const gate = useRef(false);

  useEffect(() => {
    let active = true;

    void loadLeadTimeline({ leadId, page: 0 })
      .then((response) => {
        if (active) setResult(response);
      })
      .catch(() => {
        if (active)
          setResult({
            status: 'error',
            message: 'Timeline could not be loaded. Retry loading.',
            retryable: true,
          });
      });

    return () => {
      active = false;
    };
  }, [leadId]);

  async function reload(next: number) {
    if (gate.current) return;

    gate.current = true;
    setLoading(true);

    try {
      setResult(await loadLeadTimeline({ leadId, page: next }));
      setPage(next);
    } catch {
      setResult({
        status: 'error',
        message: 'Timeline could not be loaded. Retry loading.',
        retryable: true,
      });
    } finally {
      gate.current = false;
      setLoading(false);
    }
  }

  const locked = loading || result === null;

  return (
    <div className="mx-auto mt-6 max-w-7xl">
      <DetailSection
        id="combined-activity"
        title="Lead activity timeline"
        description="Recorded history across lead changes, requirements, rooms, internal notes, site visits, follow-ups and manual logs."
        actions={
          <Button
            variant="outline"
            disabled={locked}
            onClick={() =>
              startTransition(() => {
                void reload(0);
              })
            }
          >
            Reload activity timeline
          </Button>
        }
      >
        {(loading || result === null) && <p role="status">Loading activity timeline…</p>}
        {result?.status === 'error' && <p role="alert">{result.message}</p>}

        {result?.status === 'ok' && (
          <>
            <p role="status" className="mb-4 text-sm text-muted-foreground">
              Timeline page {page + 1}: {result.data.rows.length} of {result.data.total}. Newest
              recorded events first. Times use Asia/Dubai.
            </p>

            <p className="mb-4 text-sm text-muted-foreground">
              Reload after changes in other sections. Older history remains accessible through
              pagination; new events can shift page boundaries.
            </p>

            {result.data.rows.length === 0 && <p>No timeline events on this page.</p>}

            <ol className="space-y-5">
              {result.data.rows.map((event) => (
                <li key={event.id} className="space-y-2 border-l-2 border-border pl-4">
                  <h3 className="break-words font-semibold">{event.title.replaceAll('_', ' ')}</h3>

                  <p className="text-sm">Recorded {time(event.recorded_at)} (Dubai)</p>

                  {event.activity_at !== event.recorded_at && (
                    <p className="text-sm">Actual activity {time(event.activity_at)} (Dubai)</p>
                  )}

                  <p className="break-all text-xs text-muted-foreground">Actor: {event.actor_id}</p>

                  <details>
                    <summary className="cursor-pointer text-sm">Recorded evidence</summary>
                    <div className="mt-2 rounded-control bg-muted p-3 text-sm">
                      <Evidence value={event.details} />
                    </div>
                  </details>
                </li>
              ))}
            </ol>

            <div className="mt-5 flex flex-wrap gap-3">
              <Button
                variant="outline"
                disabled={locked || page === 0}
                onClick={() =>
                  startTransition(() => {
                    void reload(page - 1);
                  })
                }
              >
                Previous timeline page
              </Button>

              <Button
                variant="outline"
                disabled={locked || (page + 1) * 20 >= result.data.total}
                onClick={() =>
                  startTransition(() => {
                    void reload(page + 1);
                  })
                }
              >
                Next timeline page
              </Button>
            </div>
          </>
        )}
      </DetailSection>
    </div>
  );
}
