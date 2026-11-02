import type { ComponentProps } from 'react';
import { LoaderCircle } from 'lucide-react';
import { cn, focusRing } from '@/lib/utils';
import { Icon } from './icon';

const variants = {
  primary: 'border-primary bg-primary text-primary-foreground hover:bg-primary/90',
  secondary: 'border-secondary bg-secondary text-secondary-foreground hover:bg-secondary/80',
  outline: 'border-input bg-card text-foreground hover:bg-muted',
  ghost: 'border-transparent bg-transparent text-foreground hover:bg-muted',
  destructive:
    'border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90',
};
const sizes = {
  sm: 'min-h-11 px-3 text-sm',
  md: 'min-h-12 px-4 text-sm',
  lg: 'min-h-13 px-5 text-base',
};

export function buttonClassName({
  variant = 'primary',
  size = 'md',
  className,
}: {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  className?: string;
} = {}) {
  return cn(
    'inline-flex shrink-0 items-center justify-center gap-2 rounded-control border font-semibold transition-colors duration-150 motion-reduce:transition-none disabled:pointer-events-none disabled:opacity-50',
    focusRing,
    variants[variant],
    sizes[size],
    className,
  );
}

export type ButtonProps = ComponentProps<'button'> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
};

export function Button({
  variant,
  size,
  loading = false,
  disabled,
  type = 'button',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClassName({ variant, size, className })}
    >
      {loading && <Icon icon={LoaderCircle} className="animate-spin motion-reduce:animate-none" />}
      {children}
      {loading && <span className="sr-only"> — loading</span>}
    </button>
  );
}
