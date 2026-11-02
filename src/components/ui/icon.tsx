import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const sizes = { sm: 'size-4', md: 'size-5', lg: 'size-6' };

export function Icon({
  icon: Glyph,
  size = 'md',
  label,
  className,
}: {
  icon: LucideIcon;
  size?: keyof typeof sizes;
  label?: string;
  className?: string;
}) {
  return (
    <Glyph
      strokeWidth={1.75}
      className={cn('shrink-0', sizes[size], className)}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
      focusable="false"
    />
  );
}
