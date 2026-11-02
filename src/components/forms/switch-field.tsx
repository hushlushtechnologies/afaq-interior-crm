'use client';

import { useId, type ComponentProps } from 'react';
import { Label } from '@/components/ui/label';
import { fieldDescriptionIds } from '@/lib/forms/field-description';
import { cn } from '@/lib/utils';

type SwitchFieldProps = Omit<
  ComponentProps<'input'>,
  'id' | 'type' | 'role' | 'children' | 'checked' | 'defaultChecked' | 'onChange'
> & {
  id?: string;
  label: string;
  description?: string;
  error?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
};

export function SwitchField({
  id,
  label,
  description,
  error,
  checked,
  onCheckedChange,
  disabled = false,
  required = false,
  className,
  ...props
}: SwitchFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? `switch-${generatedId}`;

  return (
    <div className={cn('min-w-0', className)}>
      <Label
        htmlFor={fieldId}
        required={required}
        className={cn(
          'flex min-h-12 items-center gap-3 py-2 text-sm leading-6',
          disabled ? 'cursor-not-allowed text-muted-foreground' : 'cursor-pointer',
        )}
      >
        <input
          {...props}
          id={fieldId}
          type="checkbox"
          role="switch"
          checked={checked}
          aria-checked={checked}
          disabled={disabled}
          required={required}
          onChange={(event) => onCheckedChange(event.target.checked)}
          aria-invalid={error ? true : props['aria-invalid']}
          aria-describedby={fieldDescriptionIds(
            fieldId,
            description,
            error,
            props['aria-describedby'],
          )}
          className="peer sr-only"
        />

        <span
          aria-hidden="true"
          className={cn(
            'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors duration-150',
            'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-ring',
            'peer-disabled:opacity-60 motion-reduce:transition-none',
            checked ? 'border-primary bg-primary' : 'border-input bg-muted',
          )}
        >
          <span
            className={cn(
              'block size-5 rounded-full bg-card shadow-control transition-transform duration-150 motion-reduce:transition-none',
              checked ? 'translate-x-6' : 'translate-x-1',
            )}
          />
        </span>

        <span className="min-w-0 flex-1">{label}</span>
      </Label>

      {description ? (
        <p id={`${fieldId}-description`} className="text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      ) : null}

      {error ? (
        <p id={`${fieldId}-error`} className="mt-2 text-sm font-medium text-destructive">
          Error: {error}
        </p>
      ) : null}
    </div>
  );
}
