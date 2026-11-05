'use client';

import { useId } from 'react';
import { fieldDescriptionIds } from '@/lib/forms/field-description';
import { cn, focusRing } from '@/lib/utils';

export type RadioOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

type RadioGroupFieldProps = {
  id?: string;
  name: string;
  label: string;
  description?: string;
  error?: string;
  value: string;
  options: readonly RadioOption[];
  onValueChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
};

export function RadioGroupField({
  id,
  name,
  label,
  description,
  error,
  value,
  options,
  onValueChange,
  required = false,
  disabled = false,
  className,
}: RadioGroupFieldProps) {
  const generatedId = useId();
  const groupId = id ?? `radio-group-${generatedId}`;
  const groupDescriptionIds = fieldDescriptionIds(groupId, description, error);

  return (
    <fieldset
      id={groupId}
      disabled={disabled}
      aria-describedby={groupDescriptionIds}
      aria-invalid={error ? true : undefined}
      className={cn('min-w-0 space-y-3', className)}
    >
      <legend className="text-sm font-medium text-foreground">
        {label}

        {required ? (
          <span aria-hidden="true" className="ml-1 text-destructive">
            *
          </span>
        ) : null}
      </legend>

      {description ? (
        <p id={`${groupId}-description`} className="text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        {options.map((option, index) => {
          const optionId = `${groupId}-${index}`;
          const optionLabelId = `${optionId}-label`;
          const optionDescriptionId = option.description ? `${optionId}-description` : undefined;

          const describedBy = [groupDescriptionIds, optionDescriptionId].filter(Boolean).join(' ');

          const isDisabled = disabled || option.disabled;

          return (
            <label
              key={option.value}
              htmlFor={optionId}
              className={cn(
                'flex min-h-16 min-w-0 items-start gap-3 rounded-control border p-4 transition-colors motion-reduce:transition-none',
                value === option.value ? 'border-accent bg-accent-soft' : 'border-border bg-card',
                isDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
              )}
            >
              <input
                id={optionId}
                type="radio"
                name={name}
                value={option.value}
                checked={value === option.value}
                required={required}
                disabled={isDisabled}
                onChange={() => onValueChange(option.value)}
                aria-labelledby={optionLabelId}
                aria-describedby={describedBy || undefined}
                className={cn('mt-0.5 size-5 shrink-0 accent-primary', focusRing)}
              />

              <span className="min-w-0">
                <span id={optionLabelId} className="block text-sm font-semibold text-foreground">
                  {option.label}
                </span>

                {option.description ? (
                  <span
                    id={optionDescriptionId}
                    className="mt-1 block text-xs leading-5 text-muted-foreground"
                  >
                    {option.description}
                  </span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>

      {error ? (
        <p id={`${groupId}-error`} className="text-sm font-medium text-destructive">
          Error: {error}
        </p>
      ) : null}
    </fieldset>
  );
}
