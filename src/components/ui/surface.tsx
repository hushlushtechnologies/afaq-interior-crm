import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

const tones = {
  solid: 'bg-card text-card-foreground',
  muted: 'bg-muted text-foreground',
  inverse: 'border-inverse bg-inverse text-inverse-foreground',
  glass: 'glass-panel text-card-foreground',
};

export function Surface({
  tone = 'solid',
  className,
  ...props
}: ComponentProps<'div'> & { tone?: keyof typeof tones }) {
  return (
    <div
      {...props}
      className={cn('min-w-0 rounded-panel border border-border', tones[tone], className)}
    />
  );
}

export function GlassPanel(props: Omit<ComponentProps<typeof Surface>, 'tone'>) {
  return <Surface {...props} tone="glass" />;
}
