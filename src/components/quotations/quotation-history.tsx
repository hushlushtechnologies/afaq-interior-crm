'use client';

import { useRef, useState } from 'react';
import { DetailSection } from '@/components/layout/detail-section';
import { FormField } from '@/components/forms/form-field';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import type { Result } from '@/features/leads/schemas';
import { loadQuotationHistory, loadQuotationSnapshot } from '@/features/quotations/history-actions';
import type {
  QuotationHistoryPage,
  QuotationSnapshot,
} from '@/features/quotations/history-contracts';
import { compareQuotationSnapshots } from '@/features/quotations/compare-snapshots';
import { quotationMoney } from '@/features/quotations/query-contracts';

const date = (value: string) =>
  new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Dubai',
  }).format(new Date(value));

const label = (value: string) =>
  value.replace(/([A-Z])/g, ' $1').replace(/^./, (first) => first.toUpperCase());

export function QuotationHistory({
  id,
  initial,
}: {
  id: string;
  initial: Result<QuotationHistoryPage>;
}) {
  const [result, setResult] = useState(initial);
  const [page, setPage] = useState(0);

  const [before, setBefore] = useState(
    String(
      initial.status === 'ok'
        ? (initial.data.rows[1]?.version ?? initial.data.rows[0]?.version ?? 1)
        : 1,
    ),
  );

  const [after, setAfter] = useState(
    String(initial.status === 'ok' ? (initial.data.rows[0]?.version ?? 1) : 1),
  );

  const [busy, setBusy] = useState(false);

  const [pair, setPair] = useState<{ before: QuotationSnapshot; after: QuotationSnapshot } | null>(
    null,
  );

  const gate = useRef(false);
  const rows = result.status === 'ok' ? result.data.rows : [];

  async function reload(next = page) {
    if (gate.current) return;

    gate.current = true;
    setBusy(true);
    setPair(null);

    try {
      setResult(await loadQuotationHistory({ id, page: next }));
      setPage(next);
    } catch {
      setResult({
        status: 'error',
        message: 'History could not be loaded. Retry loading.',
        retryable: true,
      });
    } finally {
      gate.current = false;
      setBusy(false);
    }
  }

  async function inspect(left = Number(before), right = Number(after)) {
    if (gate.current) return;

    gate.current = true;
    setBusy(true);
    setPair(null);

    try {
      const [a, b] = await Promise.all([
        loadQuotationSnapshot({ id, version: left }),
        left === right ? Promise.resolve(null) : loadQuotationSnapshot({ id, version: right }),
      ]);

      if (a.status === 'error') {
        setResult(a);
        return;
      }

      if (b?.status === 'error') {
        setResult(b);
        return;
      }

      setPair({ before: a.data, after: b?.status === 'ok' ? b.data : a.data });
    } catch {
      setResult({
        status: 'error',
        message: 'Saved versions could not be loaded. Reload history.',
        retryable: true,
      });
    } finally {
      gate.current = false;
      setBusy(false);
    }
  }

  const comparison = pair ? compareQuotationSnapshots(pair.before, pair.after) : null;

  return (
    <div className="mx-auto min-w-0 max-w-7xl">
      <DetailSection
        id="quotation-history"
        title="Saved draft history"
        description="Commercial revisions and saved draft versions are separate. These records are internal evidence, not approval or delivery."
        actions={
          <Button variant="outline" disabled={busy} onClick={() => void reload()}>
            Reload quotation history
          </Button>
        }
      >
        {busy && <p role="status">Loading saved quotation evidence…</p>}

        {result.status === 'error' ? (
          <p role="alert">{result.message}</p>
        ) : (
          <>
            <p role="status" className="mb-4 text-sm text-muted-foreground">
              History page {page + 1}: {rows.length} of {result.data.total} saved versions
            </p>

            {rows.length === 0 && <p>No saved versions on this page.</p>}

            <ol className="space-y-3">
              {rows.map((row) => (
                <li key={row.version} className="rounded-control border border-border p-4">
                  <p className="font-semibold">
                    Revision {row.revision} · Saved version {row.version}
                    {row.isLatestSave ? ' · Latest save' : ''}
                  </p>

                  <p className="mt-1 break-all text-xs text-muted-foreground">
                    Saved by {row.actorId} · {date(row.occurredAt)} (Dubai)
                  </p>

                  <details className="mt-2 text-sm">
                    <summary className="cursor-pointer">Revision provenance</summary>
                    <p className="mt-2 break-all">
                      Revision created by {row.revisionCreatedBy} · {date(row.revisionCreatedAt)}{' '}
                      (Dubai). {row.reason ?? 'Initial draft revision.'}
                    </p>
                  </details>

                  <Button
                    className="mt-3"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void inspect(row.version, row.version)}
                  >
                    View saved version {row.version}
                  </Button>
                </li>
              ))}
            </ol>

            <div className="my-4 flex flex-wrap gap-3">
              <Button
                variant="outline"
                disabled={busy || page === 0}
                onClick={() => void reload(page - 1)}
              >
                Previous history page
              </Button>

              <Button
                variant="outline"
                disabled={busy || page >= 10000 || (page + 1) * 20 >= result.data.total}
                onClick={() => void reload(page + 1)}
              >
                Next history page
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { name: 'Before saved version', value: before, set: setBefore },
                { name: 'After saved version', value: after, set: setAfter },
              ].map((select) => (
                <FormField key={select.name} label={select.name} disabled={busy}>
                  {(props) => (
                    <NativeSelect
                      {...props}
                      value={select.value}
                      onChange={(event) => {
                        select.set(event.target.value);
                        setPair(null);
                      }}
                    >
                      {!rows.some((row) => String(row.version) === select.value) && (
                        <option value={select.value}>
                          Saved version {select.value} (selected)
                        </option>
                      )}

                      {rows.map((row) => (
                        <option key={row.version} value={row.version}>
                          Revision {row.revision} · Saved version {row.version}
                        </option>
                      ))}
                    </NativeSelect>
                  )}
                </FormField>
              ))}
            </div>

            <Button
              className="mt-4"
              disabled={busy || before === after || !rows.length}
              onClick={() => void inspect()}
            >
              Compare saved versions
            </Button>

            <p className="mt-2 text-xs text-muted-foreground">
              Selections remain available when paging. Save another draft version to compare
              changes.
            </p>
          </>
        )}

        {pair && comparison && (
          <div className="mt-6 space-y-5">
            <h3 className="font-semibold">
              Saved version {pair.before.version}
              {pair.before.version !== pair.after.version
                ? ` compared with saved version ${pair.after.version}`
                : ''}
            </h3>

            <div className="max-w-full overflow-x-auto rounded-control border border-border">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Saved financial comparison in AED</caption>
                <thead>
                  <tr>
                    <th scope="col" className="p-3">
                      Amount
                    </th>
                    <th scope="col" className="p-3">
                      Before
                    </th>
                    <th scope="col" className="p-3">
                      After
                    </th>
                    <th scope="col" className="p-3">
                      Change (AED)
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {comparison.totals.map((row) => (
                    <tr key={row.field} className="border-t border-border">
                      <th scope="row" className="p-3">
                        {label(row.field)}
                      </th>
                      <td className="whitespace-nowrap p-3">{quotationMoney(row.before)}</td>
                      <td className="whitespace-nowrap p-3">{quotationMoney(row.after)}</td>
                      <td className="whitespace-nowrap p-3">{row.delta}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {comparison.changes.length === 0 && comparison.items.length === 0 && (
              <p>No saved input differences.</p>
            )}

            {comparison.changes.map((change) => (
              <details key={change.field} className="rounded-control border border-border p-3">
                <summary className="cursor-pointer font-medium">
                  {label(change.field)} changed
                </summary>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                  Before: {change.before}
                </p>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                  After: {change.after}
                </p>
              </details>
            ))}

            {comparison.items.map((item) => (
              <details key={item.id} className="rounded-control border border-border p-3">
                <summary className="cursor-pointer font-medium">
                  {item.action}: {item.description}
                </summary>
                <p className="mt-2 whitespace-pre-wrap break-words text-xs">
                  Before: {item.before}
                </p>
                <p className="mt-2 whitespace-pre-wrap break-words text-xs">After: {item.after}</p>
              </details>
            ))}

            {pair.before.version === pair.after.version && (
              <details>
                <summary className="cursor-pointer font-medium">Recorded input details</summary>
                <pre className="mt-3 whitespace-pre-wrap break-words text-xs">
                  {JSON.stringify(pair.after.document, null, 2)}
                </pre>
              </details>
            )}
          </div>
        )}
      </DetailSection>
    </div>
  );
}