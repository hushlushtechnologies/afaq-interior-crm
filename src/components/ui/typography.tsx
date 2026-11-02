import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

const headingSizes = {
  hero: 'text-4xl leading-[1.12] tracking-[-0.045em] sm:text-5xl lg:text-6xl',
  xl: 'text-3xl leading-tight tracking-tight sm:text-4xl',
  lg: 'text-2xl leading-tight tracking-tight sm:text-3xl',
  md: 'text-lg leading-snug tracking-tight sm:text-xl',
};

export function Heading({
  as: Tag = 'h2',
  size = 'lg',
  className,
  ...props
}: ComponentProps<'h2'> & {
  as?: 'h1' | 'h2' | 'h3' | 'h4';
  size?: keyof typeof headingSizes;
}) {
  return (
    <Tag
      {...props}
      className={cn('font-semibold wrap-break-word', headingSizes[size], className)}
    />
  );
}

export function Text({
  tone = 'default',
  className,
  ...props
}: ComponentProps<'p'> & { tone?: 'default' | 'muted' | 'inverse' }) {
  return (
    <p
      {...props}
      className={cn(
        'text-base leading-relaxed',
        tone === 'muted' && 'text-muted-foreground',
        tone === 'inverse' && 'text-inverse-muted',
        className,
      )}
    />
  );
}

export function Eyebrow({ className, ...props }: ComponentProps<'p'>) {
  return (
    <p
      {...props}
      className={cn(
        'text-xs leading-relaxed font-semibold tracking-[0.15em] text-muted-foreground uppercase',
        className,
      )}
    />
  );
}
