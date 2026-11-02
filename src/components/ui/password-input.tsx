'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useId, useState, type ComponentProps } from 'react';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type PasswordInputProps = Omit<ComponentProps<'input'>, 'type'>;

export function PasswordInput({ id, className, disabled = false, ...props }: PasswordInputProps) {
  const generatedId = useId();
  const inputId = id ?? `password-${generatedId}`;
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative min-w-0">
      <Input
        {...props}
        id={inputId}
        type={visible ? 'text' : 'password'}
        disabled={disabled}
        className={cn('pr-16', className)}
      />

      <IconButton
        type="button"
        label={visible ? 'Hide password' : 'Show password'}
        icon={visible ? EyeOff : Eye}
        variant="ghost"
        disabled={disabled}
        aria-controls={inputId}
        onClick={() => setVisible((current) => !current)}
        className="absolute right-1 top-1/2 -translate-y-1/2"
      />
    </div>
  );
}
