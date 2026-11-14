'use client';

import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import { DetailSection } from '@/components/layout/detail-section';
import { FormField } from '@/components/forms/form-field';
import { Button, buttonClassName } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import type { Result } from '@/features/leads/schemas';
import { loadQuotationPage } from '@/features/quotations/queries';
import { quotationMoney, type QuotationPage, type QuotationQuery } from '@/features/quotations/query-contracts';

type Row = QuotationPage['rows'][number];
const date = (value: string) => new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium', timeZone: 'Asia/Dubai',
}).format(new Date(value));

export function QuotationList({
  initial, query: initialQuery, createHref,
}: {
  initial: Result<QuotationPage>;
  query: QuotationQuery;
  createHref?: string;
}) {
  'use no memo';

  const [result, setResult] = useState(initial);
  const [query, setQuery] = useState(initialQuery);
  const [search, setSearch] = useState(initialQuery.search);
  const [owner, setOwner] = useState(initialQuery.owner);
  const [status, setStatus] = useState(initialQuery.status);
  const [loading, setLoading] = useState(false);
  const gate = useRef(false);

  async function load(next: QuotationQuery) {
    if (gate.current) return;
    gate.current = true;
    setLoading(true);
    try {
      setResult(await loadQuotationPage(next));
      setQuery(next);
    } catch {
      setResult({ status: 'error', message: 'Quotations could not be loaded. Retry loading.', retryable: true });
      setQuery(next);
    } finally {
      gate.current = false;
      setLoading(false);
    }
  }

  const columns = useMemo<ColumnDef<Row>[]>(() => [
    {
      accessorKey: 'number',
      header: 'Quotation',
      cell: ({ row }) => (
        <Link className="font-semibold underline underline-offset-4" href={`/quotations/${row.original.id}`}>
          {row.original.number}
        </Link>
      ),
    },
    {
      accessorKey: 'customerName',
      header: 'Customer',
      cell: ({ row }) => (
        <div className="min-w-36">
          <p>{row.original.customerName}</p>
          <p className="text-xs text-muted-foreground">{row.original.title}</p>
        </div>
      ),
    },
    {
      id: 'lead',
      header: 'Lead',
      cell: ({ row }) => row.original.canReadLead ? (
        <Link className="underline underline-offset-4" href={`/leads/details/${row.original.leadId}`}>
          #{row.original.leadReference}
        </Link>
      ) : `#${row.original.leadReference}`,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: () => <span className="rounded-control bg-muted px-2 py-1 text-xs font-medium">Draft</span>,
    },
    {
      accessorKey: 'amount',
      header: 'Amount',
      cell: ({ row }) => (
        <span className="whitespace-nowrap font-semibold tabular-nums">{quotationMoney(row.original.amount)}</span>
      ),
    },
    { accessorKey: 'ownerName', header: 'Owner', cell: ({ row }) => row.original.ownerName ?? 'Unassigned' },
    { accessorKey: 'createdAt', header: 'Created', cell: ({ row }) => date(row.original.createdAt) },
    { accessorKey: 'updatedAt', header: 'Updated', cell: ({ row }) => date(row.original.updatedAt) },
    {
      id: 'actions',
      header: 'Action',
      cell: ({ row }) => (
        <Link href={`/quotations/${row.original.id}`} aria-label={`Open ${row.original.number}`} className={buttonClassName({ variant: 'outline', size: 'sm' })}>
          Open
        </Link>
      ),
    },
  ], []);

  // TanStack manages mutable table instances; this component opts out of memoization.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: result.status === 'ok' ? result.data.rows : [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
    getRowId: (row) => row.id,
  });

  return (
    <DetailSection
      id={query.leadId ? 'lead-quotations' : 'quotation-list'}
      title="Quotations"
      description="Draft commercial records. Amounts are quoted values, not revenue."
      actions={createHref ? (
        <Link className={buttonClassName()} href={createHref}>
          {query.leadId ? 'Create quotation' : 'Choose lead to create quotation'}
        </Link>
      ) : undefined}
    >
      <form onSubmit={(event) => {
        event.preventDefault();
        void load({ ...query, page: 0, search, owner, status });
      }}>
        <fieldset disabled={loading} className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <legend className="sr-only">Quotation filters</legend>
          <FormField label="Search quotations">
            {(props) => <Input {...props} value={search} maxLength={100} placeholder="Number, customer, title or lead" onChange={(event) => setSearch(event.target.value)} />}
          </FormField>
          <FormField label="Owner filter">
            {(props) => (
              <NativeSelect {...props} value={owner} onChange={(event) => setOwner(event.target.value as QuotationQuery['owner'])}>
                <option value="all">All visible owners</option>
                <option value="mine">My quotations</option>
                <option value="unassigned">Unassigned</option>
              </NativeSelect>
            )}
          </FormField>
          <FormField label="Status filter">
            {(props) => (
              <NativeSelect {...props} value={status} onChange={(event) => setStatus(event.target.value as QuotationQuery['status'])}>
                <option value="all">All available statuses</option>
                <option value="draft">Draft</option>
              </NativeSelect>
            )}
          </FormField>
          <div className="flex flex-wrap items-end gap-2">
            <Button type="submit">Search</Button>
            <Button variant="outline" onClick={() => {
              setSearch(''); setOwner('all'); setStatus('all');
              void load({ ...query, page: 0, search: '', owner: 'all', status: 'all' });
            }}>
              Clear filters
            </Button>
          </div>
        </fieldset>
      </form>

      <div className="my-4 grid gap-3 sm:grid-cols-2">
        <FormField label="Sort quotations" disabled={loading}>
          {(props) => (
            <NativeSelect {...props} value={query.sort} onChange={(event) => void load({
              ...query, page: 0, sort: event.target.value as QuotationQuery['sort'],
            })}>
              <option value="created">Created date</option>
              <option value="updated">Updated date</option>
              <option value="number">Quotation number</option>
              <option value="customer">Customer</option>
              <option value="amount">Amount</option>
              <option value="owner">Owner</option>
            </NativeSelect>
          )}
        </FormField>
        <FormField label="Sort direction" disabled={loading}>
          {(props) => (
            <NativeSelect {...props} value={query.direction} onChange={(event) => void load({
              ...query, page: 0, direction: event.target.value as QuotationQuery['direction'],
            })}>
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </NativeSelect>
          )}
        </FormField>
      </div>

      {loading && <p role="status">Loading quotations…</p>}
      {result.status === 'error' ? (
        <div className="space-y-3">
          <p role="alert">{result.message}</p>
          <Button variant="outline" disabled={loading} onClick={() => void load(query)}>
            Retry loading quotations
          </Button>
        </div>
      ) : (
        <>
          <p role="status" className="mb-3 text-sm text-muted-foreground">
            Page {query.page + 1}: {result.data.rows.length} of {result.data.total} quotations
          </p>
          {result.data.rows.length === 0 ? (
            <p className="py-6 text-sm">No quotations match these filters.</p>
          ) : (
            <div className="max-w-full overflow-x-auto rounded-control border border-border">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Authorized quotations</caption>
                <thead className="bg-muted">
                  {table.getHeaderGroups().map((group) => (
                    <tr key={group.id}>
                      {group.headers.map((header) => (
                        <th scope="col" key={header.id} className="whitespace-nowrap p-3 font-semibold">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map((row) => (
                    <tr key={row.id} className="border-t border-border">
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="p-3 align-top">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-3">
            <Button variant="outline" disabled={loading || query.page === 0} onClick={() => void load({ ...query, page: query.page - 1 })}>
              Previous quotation page
            </Button>
            <Button variant="outline" disabled={loading || (query.page + 1) * 20 >= result.data.total} onClick={() => void load({ ...query, page: query.page + 1 })}>
              Next quotation page
            </Button>
          </div>
        </>
      )}
    </DetailSection>
  );
}