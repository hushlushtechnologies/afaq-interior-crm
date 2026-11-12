'use client';

import Link from 'next/link';
import { startTransition, useId, useRef, useState } from 'react';
import { useAccess } from '@/components/access/access-provider';
import { PageHeader } from '@/components/layout/page-header';
import { DetailSection } from '@/components/layout/detail-section';
import { Button, buttonClassName } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { hasRequiredScope } from '@/features/access/permissions';
import { loadFollowUps } from '@/features/follow-ups/actions';
import {
  followUpViewSchema,
  type FollowUpPage,
  type FollowUpQuery,
} from '@/features/follow-ups/contracts';
import { followUpTimeFlags } from '@/features/follow-ups/schemas';
import type { Result } from '@/features/leads/schemas';

const time = (value: string) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dubai',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));

const names = {
  all: 'All statuses',
  open: 'Open',
  today: 'Today',
  overdue: 'Overdue',
  upcoming: 'Upcoming',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export function FollowUpWorkspace({ initial }: { initial: Result<FollowUpPage> }) {
  const { snapshot } = useAccess();
  const teamAllowed = hasRequiredScope(snapshot, 'leads.view', 'company');
  const [result, setResult] = useState(initial);
  const [query, setQuery] = useState<FollowUpQuery>({
    leadId: null,
    page: 0,
    view: 'today',
    mine: true,
  });
  const [loading, setLoading] = useState(false);
  const gate = useRef(false);
  const prefix = useId();

  async function reload(next: FollowUpQuery) {
    if (gate.current) return;

    gate.current = true;
    setLoading(true);

    try {
      setResult(await loadFollowUps(next));
      setQuery(next);
    } catch {
      setResult({
        status: 'error',
        message: 'Follow-ups could not be loaded. Retry loading.',
        retryable: true,
      });
    } finally {
      gate.current = false;
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto min-w-0 max-w-7xl space-y-6">
      <PageHeader
        title="Daily follow-ups"
        description="Plan employee tasks and review recorded outcomes. Times use Asia/Dubai; reminders are not connected."
      />

      <DetailSection
        id="daily-follow-ups"
        title={query.mine ? 'My follow-ups' : 'Team follow-ups'}
        description="My follow-ups shows tasks assigned to you on leads you can currently view. Team access requires company-wide lead visibility."
        actions={
          <Button
            variant="outline"
            disabled={loading}
            onClick={() =>
              startTransition(() => {
                void reload(query);
              })
            }
          >
            Reload daily follow-ups
          </Button>
        }
      >
        <div className="mb-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${prefix}-scope`} className="text-sm">
              Follow-up scope
            </label>

            <NativeSelect
              id={`${prefix}-scope`}
              value={query.mine ? 'mine' : 'team'}
              disabled={loading}
              onChange={(event) => {
                const mine = event.target.value !== 'team';
                if (!mine && !teamAllowed) return;

                startTransition(() => {
                  void reload({ ...query, page: 0, mine });
                });
              }}
            >
              <option value="mine">My follow-ups</option>
              {teamAllowed && <option value="team">Team follow-ups</option>}
            </NativeSelect>
          </div>

          <div>
            <label htmlFor={`${prefix}-view`} className="text-sm">
              Daily follow-up view
            </label>

            <NativeSelect
              id={`${prefix}-view`}
              value={query.view}
              disabled={loading}
              onChange={(event) => {
                const view = followUpViewSchema.parse(event.target.value);

                startTransition(() => {
                  void reload({ ...query, page: 0, view });
                });
              }}
            >
              {followUpViewSchema.options.map((view) => (
                <option key={view} value={view}>
                  {names[view]}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>

        <p className="mb-4 text-sm text-muted-foreground">
          Today and overdue can overlap. Counts and overdue labels reflect the server time shown
          below; reload to update them.
        </p>

        {loading && <p role="status">Loading daily follow-ups…</p>}

        {result.status === 'error' ? (
          <p role="alert">{result.message}</p>
        ) : (
          <>
            <p role="status" className="mb-4 text-sm">
              {names[query.view]} page {query.page + 1}: {result.data.rows.length} of{' '}
              {result.data.total}. As of {time(result.data.asOf)} (Dubai).
            </p>

            {result.data.rows.length === 0 && <p>No follow-ups match this view.</p>}

            <ol className="space-y-4">
              {result.data.rows.map((row) => {
                const flags = followUpTimeFlags(row.due_at, row.status, result.data.asOf);

                return (
                  <li
                    key={row.id}
                    className="min-w-0 space-y-3 rounded-control border border-border p-4"
                  >
                    <h3 className="break-words font-semibold">{row.title}</h3>

                    <p className="break-words text-sm">
                      Lead #{row.lead_reference} · {row.customer_name}
                    </p>

                    <p className="text-sm">
                      {row.status} · {row.kind.replaceAll('_', ' ')} · {row.priority}
                      {flags.overdue ? ' · Overdue' : ''}
                    </p>

                    <p className="text-sm">Due {time(row.due_at)} (Dubai)</p>

                    <p className="break-all text-xs text-muted-foreground">
                      Assigned employee:{' '}
                      {row.assigned_user_id === snapshot.userId ? 'You' : row.assigned_user_id}
                    </p>

                    {row.description && (
                      <p className="whitespace-pre-wrap break-words text-sm">{row.description}</p>
                    )}

                    {row.needs_assignment_review && (
                      <p className="text-sm">
                        Assignment needs review. Reassign explicitly to the current active Sales
                        owner in Lead Details.
                      </p>
                    )}

                    {row.read_only && (
                      <p className="text-sm">
                        Read-only task: finalized, closed lead or restricted update permission.
                      </p>
                    )}

                    {row.actual_at && (
                      <p className="text-sm">Completed {time(row.actual_at)} (Dubai)</p>
                    )}

                    {(row.outcome || row.cancellation_reason) && (
                      <p className="whitespace-pre-wrap break-words text-sm">
                        {row.outcome ?? row.cancellation_reason}
                      </p>
                    )}

                    <Link
                      prefetch={false}
                      href={`/leads/details/${row.lead_id}#lead-follow-ups-heading`}
                      className={buttonClassName({ variant: 'outline' })}
                    >
                      Open lead follow-ups
                    </Link>
                  </li>
                );
              })}
            </ol>

            <div className="mt-5 flex flex-wrap gap-3">
              <Button
                variant="outline"
                disabled={loading || query.page === 0}
                onClick={() =>
                  startTransition(() => {
                    void reload({ ...query, page: query.page - 1 });
                  })
                }
              >
                Previous daily page
              </Button>

              <Button
                variant="outline"
                disabled={loading || (query.page + 1) * 20 >= result.data.total}
                onClick={() =>
                  startTransition(() => {
                    void reload({ ...query, page: query.page + 1 });
                  })
                }
              >
                Next daily page
              </Button>
            </div>
          </>
        )}
      </DetailSection>
    </div>
  );
}
