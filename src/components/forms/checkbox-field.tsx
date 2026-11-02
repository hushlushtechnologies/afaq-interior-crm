'use client';

import { useId, type ComponentProps } from 'react';
import { Label } from '@/components/ui/label';
import { fieldDescriptionIds } from '@/lib/forms/field-description';
import { cn, focusRing } from '@/lib/utils';

type CheckboxFieldProps = Omit<ComponentProps<'input'>, 'id' | 'type' | 'children'> & {
  id?: string;
  label: string;
  description?: string;
  error?: string;
};

export function CheckboxField({
  id,
  label,
  description,
  error,
  required = false,
  disabled = false,
  className,
  ...props
}: CheckboxFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? `checkbox-${generatedId}`;

  return (
    <div className={cn('min-w-0', className)}>
      <div className="flex min-h-12 items-center gap-3">
        <input
          {...props}
          id={fieldId}
          type="checkbox"
          required={required}
          disabled={disabled}
          aria-invalid={error ? true : props['aria-invalid']}
          aria-describedby={fieldDescriptionIds(
            fieldId,
            description,
            error,
            props['aria-describedby'],
          )}
          className={cn(
            'size-5 shrink-0 accent-primary disabled:cursor-not-allowed disabled:opacity-60',
            focusRing,
          )}
        />

        <Label
          htmlFor={fieldId}
          required={required}
          className={cn(
            'flex min-h-12 flex-1 items-center py-3 text-sm leading-6',
            disabled ? 'cursor-not-allowed text-muted-foreground' : 'cursor-pointer',
          )}
        >
          {label}
        </Label>
      </div>

      {description ? (
        <p id={`${fieldId}-description`} className="pl-8 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      ) : null}

      {error ? (
        <p id={`${fieldId}-error`} className="mt-2 pl-8 text-sm font-medium text-destructive">
          Error: {error}
        </p>
      ) : null}
    </div>
  );
}
