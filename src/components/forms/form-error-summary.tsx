'use client';

import { useId, type Ref } from 'react';
import { cn, focusRing } from '@/lib/utils';

export type FormSummaryError = {
  fieldId: string;
  message: string;
};

type FormErrorSummaryProps = {
  errors: readonly FormSummaryError[];
  ref?: Ref<HTMLDivElement>;
  className?: string;
};

export function FormErrorSummary({ errors, ref, className }: FormErrorSummaryProps) {
  const generatedId = useId();
  const headingId = `error-summary-${generatedId}`;

  if (!errors.length) {
    return null;
  }

  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      aria-labelledby={headingId}
      className={cn(
        'rounded-control border border-destructive bg-destructive-soft p-4',
        focusRing,
        className,
      )}
    >
      <h3 id={headingId} className="font-semibold text-destructive">
        Check the form
      </h3>

      <p className="mt-1 text-sm text-foreground">Correct these fields, then try again.</p>

      <ul className="mt-3 list-disc space-y-2 pl-5">
        {errors.map((error) => (
          <li key={error.fieldId} className="text-sm">
            <a
              href={`#${error.fieldId}`}
              onClick={(event) => {
                event.preventDefault();
                document.getElementById(error.fieldId)?.focus();
              }}
              className={cn(
                'rounded-sm font-medium text-destructive underline underline-offset-4',
                focusRing,
              )}
            >
              {error.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
