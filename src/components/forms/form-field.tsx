'use client';

import { useId, type ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { fieldDescriptionIds } from '@/lib/forms/field-description';
import { cn } from '@/lib/utils';

type FieldControlProps = {
  id: string;
  required: boolean;
  disabled: boolean;
  'aria-describedby': string | undefined;
  'aria-invalid': true | undefined;
};

type FormFieldProps = {
  id?: string;
  label: string;
  description?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  children: (props: FieldControlProps) => ReactNode;
};

export function FormField({
  id,
  label,
  description,
  error,
  required = false,
  disabled = false,
  className,
  children,
}: FormFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? `field-${generatedId}`;

  return (
    <div className={cn('min-w-0 space-y-2', className)}>
      <Label htmlFor={fieldId} required={required}>
        {label}
      </Label>

      {description ? (
        <p id={`${fieldId}-description`} className="text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      ) : null}

      {children({
        id: fieldId,
        required,
        disabled,
        'aria-describedby': fieldDescriptionIds(fieldId, description, error),
        'aria-invalid': error ? true : undefined,
      })}

      {error ? (
        <p id={`${fieldId}-error`} className="text-sm font-medium leading-6 text-destructive">
          Error: {error}
        </p>
      ) : null}
    </div>
  );
}
