'use client';

import Link from 'next/link';
import { CheckboxField } from '@/components/forms/checkbox-field';
import type { LeadFields } from '@/features/leads/schemas';

export const importFieldLabels = {
  customer_name: 'Customer name',
  email: 'Email',
  phone: 'Primary phone',
  alternate_phone: 'Alternate phone',
  property_type: 'Property type',
  location: 'Project location',
  budget: 'Budget (AED)',
  expected_start_on: 'Expected start date',
  inquiry_on: 'Inquiry date',
  follow_up_on: 'Intake follow-up date',
  description: 'Description',
  initial_note: 'Initial note',
  priority: 'Priority',
} as const;

export type ImportDisplayRow = {
  rowNumber: number;
  data: LeadFields | null;
  status: string;
  errors: string[];
  duplicateRows: number[];
  databaseMatch?: boolean;
  redacted?: boolean;
  leadId?: string | null;
};

export function LeadImportRows({
  rows,
  skips,
  disabled,
  onSkip,
}: {
  rows: ImportDisplayRow[];
  skips?: Set<number>;
  disabled?: boolean;
  onSkip?: (row: number, checked: boolean) => void;
}) {
  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-2">
      {rows.map((row) => (
        <article
          key={row.rowNumber}
          aria-label={`Import row ${row.rowNumber}`}
          className="min-w-0 space-y-3 rounded-control border border-border bg-background p-4"
        >
          <h3 className="break-words font-semibold">
            Row {row.rowNumber}:{' '}
            {row.data?.customer_name ?? (row.redacted ? 'Restricted lead' : 'Invalid row')}
          </h3>
          <p className="text-sm">Status: {row.status}</p>
          {row.redacted && (
            <p className="text-sm">
              Current access to the created lead is unavailable. Import counts and history are
              retained.
            </p>
          )}
          {row.errors.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {row.errors.map((error, index) => (
                <li key={`${error}:${index}`}>{error}</li>
              ))}
            </ul>
          )}
          {!!row.duplicateRows.length && (
            <p className="break-words text-sm">
              Possible match with file rows: {row.duplicateRows.join(', ')}.
            </p>
          )}
          {row.databaseMatch && (
            <p className="text-sm">
              Possible match with an existing visible lead. Matching customer details are not
              disclosed here.
            </p>
          )}
          {row.data && (
            <details className="text-sm">
              <summary className="cursor-pointer font-medium">
                Mapped lead values for row {row.rowNumber}
              </summary>
              <dl className="mt-3 space-y-2">
                {Object.entries(importFieldLabels).map(([field, label]) => {
                  const value = row.data?.[field as keyof typeof importFieldLabels];
                  return (
                    <div key={field}>
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="whitespace-pre-wrap break-words">
                        {value === null ? 'Not recorded' : String(value)}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </details>
          )}
          {onSkip && (
            <CheckboxField
              label={`Skip row ${row.rowNumber}`}
              checked={skips?.has(row.rowNumber) ?? false}
              disabled={disabled}
              onChange={(event) => onSkip(row.rowNumber, event.target.checked)}
              description={
                row.status === 'invalid' || row.status === 'review'
                  ? 'Required before confirmation. This row will not create a lead.'
                  : 'Optional: exclude this row from lead creation.'
              }
            />
          )}
          {row.leadId && !row.redacted && (
            <Link
              href={`/leads/details/${row.leadId}`}
              className="inline-flex min-h-11 items-center underline"
              aria-disabled={disabled}
              onClick={(event) => {
                if (disabled) event.preventDefault();
              }}
            >
              Open created lead
            </Link>
          )}
        </article>
      ))}
    </div>
  );
}
