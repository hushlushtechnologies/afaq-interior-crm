'use client';
'use no memo';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import { ArrowUpDown, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

import { useDemoCrm } from '@/components/demo/demo-crm-provider';
import { LeadPriorityBadge } from '@/components/leads/lead-badges';
import { LeadStageSelect } from '@/components/leads/lead-stage-select';
import { Avatar } from '@/components/ui/avatar';
import { Button, buttonClassName } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { formatDemoDate, formatDemoMoney } from '@/lib/demo/format';
import { leadDetailsHref } from '@/lib/demo/lead-views';
import { DEMO_STAGES } from '@/lib/demo/stages';
import { cn, focusRing } from '@/lib/utils';
import type { DemoLead } from '@/types/demo-crm';

const columnLabels: Record<string, string> = {
  clientName: 'Client',
  title: 'Opportunity',
  stage: 'Stage',
  owner: 'Owner',
  budget: 'Budget',
  source: 'Source',
  priority: 'Priority',
  followUp: 'Follow-up',
  actions: 'Actions',
};

export function LeadsTable({ leads }: { leads: DemoLead[] }) {
  const { data, announce } = useDemoCrm();

  const [sorting, setSorting] = useState<SortingState>([{ id: 'clientName', desc: false }]);

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  const columns = useMemo<ColumnDef<DemoLead>[]>(
    () => [
      {
        accessorKey: 'clientName',
        header: 'Client',
        enableHiding: false,
        cell: ({ row }) => (
          <Link
            href={leadDetailsHref(row.original.id)}
            className={cn(
              'inline-flex min-h-11 items-center rounded-control font-semibold',
              focusRing,
            )}
          >
            {row.original.clientName}
          </Link>
        ),
      },
      {
        accessorKey: 'title',
        header: 'Opportunity',
        cell: ({ row }) => (
          <div className="max-w-52 space-y-1">
            <p className="text-sm">{row.original.title}</p>
            <p className="text-xs text-muted-foreground">{row.original.propertyType}</p>
          </div>
        ),
      },
      {
        accessorKey: 'stage',
        header: 'Stage',
        sortingFn: (left, right) =>
          DEMO_STAGES.findIndex((stage) => stage.id === left.original.stage) -
          DEMO_STAGES.findIndex((stage) => stage.id === right.original.stage),
        cell: ({ row }) => (
          <div className="min-w-44">
            <LeadStageSelect lead={row.original} id={'table-stage-' + row.original.id} />
          </div>
        ),
      },
      {
        id: 'owner',
        accessorFn: (lead) =>
          data.owners.find((owner) => owner.id === lead.ownerId)?.name ?? 'Unassigned',
        header: 'Owner',
        cell: ({ row }) => {
          const owner = data.owners.find((candidate) => candidate.id === row.original.ownerId);

          return (
            <div className="flex items-center gap-2">
              <span aria-hidden="true">
                <Avatar name={owner?.name ?? 'Sample owner'} size="sm" />
              </span>
              <span className="text-xs">{owner?.name ?? 'Unassigned'}</span>
            </div>
          );
        },
      },
      {
        accessorKey: 'budget',
        header: 'Budget',
        cell: ({ row }) => (
          <span className="whitespace-nowrap font-semibold tabular-nums">
            {formatDemoMoney(row.original.budget)}
          </span>
        ),
      },
      {
        accessorKey: 'source',
        header: 'Source',
      },
      {
        accessorKey: 'priority',
        header: 'Priority',
        sortingFn: (left, right) => {
          const order = ['low', 'normal', 'high', 'urgent'];

          return order.indexOf(left.original.priority) - order.indexOf(right.original.priority);
        },
        cell: ({ row }) => <LeadPriorityBadge priority={row.original.priority} />,
      },
      {
        id: 'followUp',
        accessorFn: (lead) => lead.nextFollowUpOn ?? '',
        header: 'Follow-up',
        cell: ({ row }) => {
          const due = row.original.nextFollowUpOn;
          const overdue = due !== null && due < data.asOfDate;

          return (
            <span
              className={cn(
                'whitespace-nowrap text-xs',
                overdue ? 'text-warning' : 'text-muted-foreground',
              )}
            >
              {due ? formatDemoDate(due, false) : '—'}
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Link
              href={leadDetailsHref(row.original.id)}
              aria-label={'View details for ' + row.original.clientName}
              className={buttonClassName({
                variant: 'outline',
                size: 'sm',
              })}
            >
              View
            </Link>

            <IconButton
              label={'Preview follow-up for ' + row.original.clientName}
              icon={CalendarDays}
              variant="ghost"
              onClick={() =>
                announce(
                  'Follow-up action preview for ' +
                    row.original.clientName +
                    '. No reminder was created.',
                )
              }
            />
          </div>
        ),
      },
    ],
    [data.owners, data.asOfDate, announce],
  );

  const table = useReactTable({
    data: leads,
    columns,
    state: {
      sorting,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: true,
    initialState: {
      pagination: {
        pageIndex: 0,
        pageSize: 5,
      },
    },
  });

  const { pageIndex, pageSize } = table.getState().pagination;
  const firstRow = leads.length === 0 ? 0 : pageIndex * pageSize + 1;
  const lastRow = Math.min((pageIndex + 1) * pageSize, leads.length);

  return (
    <section aria-labelledby="leads-table-title" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <h2 id="leads-table-title" className="text-lg font-semibold">
            Leads table
          </h2>
          <p className="text-xs text-muted-foreground">
            Scroll horizontally on smaller screens. Use column headings to sort.
          </p>
        </div>

        <details className="rounded-control border border-border bg-card">
          <summary
            className={cn(
              'min-h-11 cursor-pointer rounded-control px-4 py-3 text-sm font-semibold',
              focusRing,
            )}
          >
            Columns
          </summary>

          <fieldset className="space-y-2 border-t border-border p-4">
            <legend className="sr-only">Visible table columns</legend>

            {table
              .getAllLeafColumns()
              .filter((column) => column.getCanHide())
              .map((column) => (
                <label
                  key={column.id}
                  className="flex min-h-11 cursor-pointer items-center gap-3 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={column.getIsVisible()}
                    onChange={column.getToggleVisibilityHandler()}
                    className={cn('size-4 accent-primary', focusRing)}
                  />
                  {columnLabels[column.id] ?? column.id}
                </label>
              ))}

            <Button variant="ghost" size="sm" onClick={() => table.resetColumnVisibility()}>
              Reset columns
            </Button>
          </fieldset>
        </details>
      </div>

      <div
        role="region"
        aria-label="Scrollable demo leads table"
        tabIndex={0}
        className={cn(
          'min-w-0 overflow-x-auto rounded-card border border-border bg-card',
          focusRing,
        )}
      >
        <table className="w-full min-w-[1050px] border-collapse text-left text-sm">
          <caption className="sr-only">
            Fictional demo leads. Changes remain local to this tab.
          </caption>

          <thead className="bg-muted">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const sorted = header.column.getIsSorted();

                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={
                        header.column.getCanSort()
                          ? sorted === 'asc'
                            ? 'ascending'
                            : sorted === 'desc'
                              ? 'descending'
                              : 'none'
                          : undefined
                      }
                      className="border-b border-border px-4 py-2 font-semibold"
                    >
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          aria-label={
                            'Sort by ' + (columnLabels[header.column.id] ?? header.column.id)
                          }
                          className={cn(
                            'inline-flex min-h-11 items-center gap-2 rounded-control text-left',
                            focusRing,
                          )}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <Icon icon={ArrowUpDown} size="sm" />
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>

          <tbody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  data-testid={'lead-row-' + row.original.id}
                  className="border-b border-border last:border-b-0 hover:bg-muted/40"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-4 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={table.getVisibleLeafColumns().length}
                  className="p-8 text-center text-muted-foreground"
                >
                  No sample leads match this view.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">
          Showing {firstRow}–{lastRow} of {leads.length} sample leads
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="lead-table-page-size">Rows per page</Label>

            <NativeSelect
              id="lead-table-page-size"
              value={pageSize}
              onChange={(event) => table.setPageSize(Number(event.target.value))}
              className="w-20"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
            </NativeSelect>
          </div>

          <IconButton
            label="Previous page"
            icon={ChevronLeft}
            variant="outline"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
          />

          <span className="text-xs tabular-nums">
            Page {pageIndex + 1} of {Math.max(1, table.getPageCount())}
          </span>

          <IconButton
            label="Next page"
            icon={ChevronRight}
            variant="outline"
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
          />
        </div>
      </div>
    </section>
  );
}
