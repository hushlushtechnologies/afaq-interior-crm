import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

const tones = {
  neutral: 'border-border bg-secondary text-secondary-foreground',
  success: 'border-success/20 bg-success-soft text-success',
  warning: 'border-warning/20 bg-warning-soft text-warning',
  destructive: 'border-destructive/20 bg-destructive-soft text-destructive',
  info: 'border-info/20 bg-info-soft text-info',
  outline: 'border-input bg-card text-foreground',
};

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: ComponentProps<'span'> & { tone?: keyof typeof tones }) {
  return (
    <span
      {...props}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs leading-5 font-semibold',
        tones[tone],
        className,
      )}
    />
  );
}
